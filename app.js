const TOP_LEVEL_COMPONENTS = [
  'js-intro', 'js-question', 'js-question-feedback', 
  'js-outro', 'js-quiz-status',
];

const Api = function(){
  const BASE_API_URL = 'https://opentdb.com';
  let sessionToken;

  const buildBaseUrl = function(amt = 10, query = {}) {
    const url = new URL(BASE_API_URL + '/api.php');
    const queryKeys = Object.keys(query);
    url.searchParams.set('amount', amt);
  
    if (sessionToken) {
      url.searchParams.set('token', sessionToken);
    }
  
    queryKeys.forEach(key => url.searchParams.set(key, query[key]));
    return url;
  };

  const buildTokenUrl = function() {
    return new URL(BASE_API_URL + '/api_token.php');
  };
  
  class Api {
    fetchToken(callback) {
      if (sessionToken) {
        return sessionToken;
      }
    
      const url = buildTokenUrl();
      url.searchParams.set('command', 'request');
    
      $.getJSON(url, res => {
        sessionToken = res.token;
        callback();
      }, err => console.log(err));
    }

    fetchQuestions(amt, query, callback) {
      $.getJSON(buildBaseUrl(amt, query), callback, err => console.log(err.message));
    }
    
  }

  return Api;
}();

const Store = function(){

  // Private variables
  const QUESTIONS = [];
  const createQuestion = function(question) {
    return {
      text: question.question,
      answers: [ ...question.incorrect_answers, question.correct_answer ],
      correctAnswer: question.correct_answer
    };
  };

  const getQuestion = function(index) {
    return QUESTIONS[index];
  };

  class Store {
    getScore() {
      return this.userAnswers.reduce((accumulator, userAnswer, index) => {
        const question = getQuestion(index);
    
        if (question.correctAnswer === userAnswer) {
          return accumulator + 1;
        } else {
          return accumulator;
        }
      }, 0);
    }

    getProgress() {
      return {
        current: this.currentQuestionIndex + 1,
        total: QUESTIONS.length
      };
    }

    // Public methods, all available on store object, called from event handlers, etc.
    setInitialStore() {
      for (const prop of Object.getOwnPropertyNames(this)) {
        delete this[prop];
      }
      this.page = 'intro';
      this.currentQuestionIndex = null;
      this.userAnswers = [];
      this.feedback = null;
    }

    isLastQuestion(){
      return this.currentQuestionIndex === QUESTIONS.length - 1;
    }
  
    seedQuestions(questions) {
      QUESTIONS.length = 0;
      questions.forEach(q => QUESTIONS.push(createQuestion(q)));
    }

    getCurrentQuestion() {
      return QUESTIONS[this.currentQuestionIndex];
    }
  }

  return Store;
}();

const Handler = function(store, renderer, api){
  this.startQuiz = function() {
    store.setInitialStore();
    const quantity = parseInt($('#js-question-quantity').find(':selected').val(), 10);

    api.fetchQuestions(quantity, { type: 'multiple' }, res => {
      if (res.response_code !== 0) {
        throw new Error(res);
      }

      store.page = 'question';
      store.currentQuestionIndex = 0;
      store.seedQuestions(res.results);
      renderer.render();
    });
  };

  this.submitAnswer = function(e) {
    e.preventDefault();
    const question = store.getCurrentQuestion();
    const selected = $('input:checked').val();
    store.userAnswers.push(selected);
    
    if (selected === question.correctAnswer) {
      store.feedback = 'You got it!';
    } else {
      store.feedback = `Too bad! The correct answer was: ${question.correctAnswer}`;
    }
  
    store.page = 'answer';
    renderer.render();
  };

  this.nextQuestion = function() {
    if (store.isLastQuestion()) {
      store.page = 'outro';
      renderer.render();
      return;
    }
  
    store.currentQuestionIndex++;
    store.page = 'question';
    renderer.render();
  };
};

const Renderer = function(store){
  const hideAll = function() {
    TOP_LEVEL_COMPONENTS.forEach(component => $(`.${component}`).hide());
  };

  const templates = {
    generateAnswerItemHtml(answer) {
      return `
        <li class="answer-item">
          <input type="radio" name="answers" value="${answer}" />
          <span class="answer-text">${answer}</span>
        </li>
      `;
    },
    
    generateQuestionHtml(question) {
      return `
        <form>
          <div class="question-text">
            ${question.text}      
          </div>
          <ul class="question-answers-list">
            ${question.answers.map((answer, index) => this.generateAnswerItemHtml(answer, index)).join('')}
          </ul>
          <div>
            <input type="submit" />
          </div>
        </form>
      `;
    },
  
    generateFeedbackHtml(feedback) {
      return `
        <p>
          ${feedback}
        </p>
        <button class="continue js-continue">Continue</button>
      `;
    }
  };
  
  this.render = function() {
    let html;
    hideAll();
  
    const { feedback, page } = store; 
    const question = store.getCurrentQuestion();
    const { current, total } = store.getProgress();
    const score = store.getScore();
  
    $('.js-score').html(`<span>Score: ${score}</span>`);
    $('.js-progress').html(`<span>Question ${current} of ${total}`);
  
    switch (page) {
      case 'intro':
        $('.js-intro').show();
        break;
      
      case 'question':
        html = templates.generateQuestionHtml(question);
        $('.js-question').html(html);
        $('.js-question').show();
        $('.quiz-status').show();
        break;
  
      case 'answer':
        html = templates.generateFeedbackHtml(feedback);
        $('.js-question-feedback').html(html);
        $('.js-question-feedback').show();
        $('.quiz-status').show();
        break;
  
      case 'outro':
        $('.js-outro').show();
        $('.quiz-status').show();
        break;

      default:
        return;
    } 
  };
};

// Put `store` in global scope for debugging.
let store;

// On DOM Ready, instantiate all services and run startup methods
$(() => {
  const api = new Api();
  store = new Store();
  const renderer = new Renderer(store);
  const handler = new Handler(store, renderer, api);

  // Setup initial store and run first render
  store.setInitialStore();
  renderer.render();

  api.fetchToken(() => {
    $('.js-start').attr('disabled', false);
  });

  $('.js-intro, .js-outro').on('click', '.js-start', handler.startQuiz);
  $('.js-question').on('submit', handler.submitAnswer);
  $('.js-question-feedback').on('click', '.js-continue', handler.nextQuestion);
});
