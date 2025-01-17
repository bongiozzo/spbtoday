/**
 * Entry-point for Serverless Function.
 *
 * @param event {Object} request payload.
 * @param context {Object} information about current execution context.
 *
 * @return {Promise<Object>} response to be serialized as JSON.
 *
 *
 * ToDo:
 * Make this dialogue great with fellow programmers at the hackathon
 *
 */

 import fetch from "node-fetch";
 import _ from 'lodash';

 function randAnswer(strings) {
     return strings[Math.floor(Math.random() * strings.length)]
 }

 async function fallback(result) {
     result.response.text = 'Мне непонятно, извините. Можете назвать день и месяц и я расскажу, что было в истории Санкт-Петербурга в этот день.';
     return result
 }

 async function welcome(result) {
     result.response.text = ('Я могу рассказывать о примечательных датах, которые произошли в истории великого города. ' +
                             'Достаточно спросить: Скажи, что было в истории Санкт Петербурга сегодня?\n' +
                             'Если Вы уже знаете все события, можно сказать Хватит.\n\n' +
                             'Какой день Вас интересует?');
     result.response.buttons = [
         {title: 'Сегодня', hide: true},
         {title: 'Завтра', hide: true},
         {title: 'Вчера', hide: true},
     ];
     return result
 }

 async function story(result) {
     let sources = [
         {
             id: 1,
             source: 'Петербургский календарь Панёвина',
             url: 'http://api.panevin.ru/v1/?date=',
             dataJson: {}
         },
         {
             id: 2,
             source: 'Библиотека Маяковского',
             url: 'https://yazzh.gate.petersburg.ru/memorable_dates/skills/date/day/',
             dataJson: {}
         }
     ];

     let requests = [];
     sources.map((source) => {
         requests.push(
             new Promise((resolve, reject) => {

                 console.log(`enter: ${source.url} ${result.session_state['storyday']}`);

                 var url = source.url + 
                              (source.id === 2 ? 
                              result.session_state['storyday'][0] + '/month/' + result.session_state['storyday'][1] : 
                              result.session_state['storyday'][2]);

                 console.log(`fetch result: ${url}`);

                 fetch(url, {headers: {'Accept-Language': 'ru-RU,ru'}}).then((response) => {
                     return response.json();
                 }).then((dataJson) => {
                     console.log('Day Data: ' + JSON.stringify(dataJson));
                     source.dataJson = dataJson;
                     resolve(source);
                 }).catch((error) => {
                     console.log('There has been a problem with your fetch operation: ' + error.message);
                     resolve(source);
                 });
            })
         );
     })

     await Promise.all(requests)
         .then(result => {
             if (result && result.length > 0) {
                 sources = result;
             }
         })
         .catch(error => console.log(`Exception when get responses from sources API - ${error.message}`));

     _.remove(sources, function (source) {
         return _.isEmpty(source.dataJson);
     });

     if (_.isEmpty(sources)) {
         console.log("No data from sources!")
         return fallback(result);
     }

     sources.forEach((value) => {
        
        console.log('Value before: ' + JSON.stringify(value));
        
        // if (value.id === 2) {
        //    value.dataJson = value.dataJson[0];
        //    value.dataJson = value.dataJson.date;
        //    value.dataJson.text = value.dataJson.description;
        // }

        console.log('Value after: ' + JSON.stringify(value));

     });

     //sorce text length ascending
     sources = _.sortBy(sources, [(source)=> source.dataJson.text.length]);

     var phrase = '';
     result.response.tts = '';
     sources.forEach((value) => {
        value.dataJson.text = value.dataJson.text.replace(/<[^>]*>?/gm, '').substring(0, 950);
        phrase = value.dataJson.date + randAnswer([', произошло вот что...\n', ' было вот что...\n', ' случилось такое событие...\n']) +
                 value.dataJson.title + '.\n\n' +
                 'Источник: ' + value.source + '. ' + '\n\n';
        result.response.text += phrase;
        phrase = phrase.replace('...\n', '... sil <[1000]>\n');
        result.response.tts += phrase + ' sil <[1500]> ';
     });

     phrase = randAnswer(['Нужны подробности? Скажите Подробнее!\n\n', 'Скажите Подробнее, если интересны детали...\n\n']) +
              randAnswer(['Если нужна другая дата - Назовите её...', 'Или назовите другую дату...']);
     result.response.text += phrase;
     result.response.tts += phrase;

     result.response.buttons = [{title: 'Подробнее', hide: true}];

     result.session_state['details'] = sources;

     return result
 }

 async function storydetails(result) {
     if (!result.session_state['details'] || !result.session_state['details'][0]) {
         return fallback(result)
     }

     result.response.text = result.session_state['details'][0]['dataJson']['text'] + '.\n\n'

     if (result.session_state['details'].length > 1) {
         result.response.text += randAnswer(['Скажите Ещё, чтобы услышать следующую историю.', 'Скажите Продолжить, чтобы услышать следующую историю.', 'Рассказать еще?']);

         result.response.buttons = [
             {title: 'Еще', hide: true},
         ];

     } else {

       result.response.text += randAnswer(['Если нужна другая дата - Назовите её.', 'Назовите другую дату.']);

       result.response.buttons = [
         {title: 'Завтра', hide: true},
         {title: 'Хватит', hide: true},
       ];
     }
     result.session_state['details'].shift();
     return result;
 }

 async function endstory(result) {
     result.response.text = randAnswer(['До свидания!', 'До новых встреч!']);
     result.response.end_session = true;
     return result
 }

 function parseday(yandexdate) {

     console.log('Date recieved: ' + JSON.stringify(yandexdate));

     var day, month;

     if (yandexdate['day_is_relative']) {
         var resultday = new Date();
         resultday.setDate(resultday.getDate() + yandexdate['day']);
         day = resultday.getDate();
         month = resultday.getMonth() + 1;
     } else {
         day = yandexdate['day'];
         month = yandexdate['month'];
     }

     return [day, month, (day < 10 ? '0' + day : day) + '.' + (month < 10 ? '0' + month : month)];
 }

 const handler = (event, context) => {
    let {version, session, request, state} = event;

    console.log('Request: ' + JSON.stringify(request));
    console.log('Session: ' + JSON.stringify(session));
    console.log('State: ' + JSON.stringify(state));

    state = state && state['session'] ? state : {session: {}};

    let result = {
        response: {
            text: '',
            buttons: [],
            end_session: false,
        },
        session_state: {
            storyday: state['session']['storyday'],
            details: state['session']['details']
        },
        version: version
    }

    if (request['nlu']['intents'].hasOwnProperty('story')) {
        result.session_state['storyday'] = parseday(request['nlu']['intents']['story']['slots']['when']['value'])
        return story(result)
    } else if (session['new'] || request['nlu']['intents'].hasOwnProperty('welcome')) {
        return welcome(result)
    } else if (state['session']['details'] && request['nlu']['intents'].hasOwnProperty('details')) {
        return storydetails(result)
    } else if (request['nlu']['intents'].hasOwnProperty('end')) {
        return endstory(result)
    } else {
        console.log('fallback(result)')
        return fallback(result)
    }
}

export { handler };
