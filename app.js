const TOP_LEVEL_COMPONENTS = [
  'js-intro', 'js-question', 'js-question-feedback', 
  'js-outro', 'js-quiz-status',
];

class Api {
  constructor(){
    this.BASE_API_URL = 'https://opentdb.com'; 
    this.sessionToken = null;
  }

  _buildBaseUrl(amt = 10, query = {}) {
    const url = new URL(this.BASE_API_URL + '/api.php');
    const queryKeys = Object.keys(query);
    url.searchParams.set('amount', amt);
  
    if (this.sessionToken) {
      url.searchParams.set('token', this.sessionToken);
    }
  
    queryKeys.forEach(key => url.searchParams.set(key, query[key]));
    return url;
  }

  _buildTokenUrl() {
    return new URL(this.BASE_API_URL + '/api_token.php');
  }

  fetchToken(callback) {
    if (this.sessionToken) {
      return this.sessionToken;
    }
  
    const url = this._buildTokenUrl();
    url.searchParams.set('command', 'request');
  
    $.getJSON(url, res => {
      this.sessionToken = res.token;
      callback();
    }, err => console.log(err));
  }

  fetchQuestions(amt, query, callback) {
    $.getJSON(this._buildBaseUrl(amt, query), callback, err => console.log(err.message));
  }
}

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

class Handler {
  constructor(store, renderer, api) {
    this.store = store;
    this.renderer = renderer;
    this.api = api;

    this.startQuiz = this.startQuiz.bind(this);
    this.submitAnswer = this.submitAnswer.bind(this);
    this.nextQuestion = this.nextQuestion.bind(this);
  }

  startQuiz() {
    this.store.setInitialStore();
    const quantity = parseInt($('#js-question-quantity').find(':selected').val(), 10);

    this.api.fetchQuestions(quantity, { type: 'multiple' }, res => {
      if (res.response_code !== 0) {
        throw new Error(res);
      }

      this.store.page = 'question';
      this.store.currentQuestionIndex = 0;
      this.store.seedQuestions(res.results);
      this.renderer.render();
    });
  }

  submitAnswer(e) {
    e.preventDefault();
    const question = this.store.getCurrentQuestion();
    const selected = $('input:checked').val();
    this.store.userAnswers.push(selected);
    
    if (selected === question.correctAnswer) {
      this.store.feedback = 'You got it!';
    } else {
      this.store.feedback = `Too bad! The correct answer was: ${question.correctAnswer}`;
    }
  
    this.store.page = 'answer';
    this.renderer.render();
  }

  nextQuestion() {
    if (store.isLastQuestion()) {
      store.page = 'outro';
      this.renderer.render();
      return;
    }
  
    store.currentQuestionIndex++;
    store.page = 'question';
    this.renderer.render();
  }
}

class Renderer {
  constructor(store) {
    this.store = store;
  }

  _hideAll() {
    TOP_LEVEL_COMPONENTS.forEach(component => $(`.${component}`).hide());
  }

  _generateAnswerItemHtml(answer) {
    return `
      <li class="answer-item">
        <input type="radio" name="answers" value="${answer}" />
        <span class="answer-text">${answer}</span>
      </li>
    `;
  }
  
  _generateQuestionHtml(question) {
    return `
      <form>
        <div class="question-text">
          ${question.text}      
        </div>
        <ul class="question-answers-list">
          ${question.answers.map((answer, index) => this._generateAnswerItemHtml(answer, index)).join('')}
        </ul>
        <div>
          <input type="submit" />
        </div>
      </form>
    `;
  }

  _generateFeedbackHtml(feedback) {
    return `
      <p>
        ${feedback}
      </p>
      <button class="continue js-continue">Continue</button>
    `;
  }

  render() {
    let html;
    this._hideAll();
  
    const { feedback, page } = this.store; 
    const question = this.store.getCurrentQuestion();
    const { current, total } = this.store.getProgress();
    const score = this.store.getScore();
  
    $('.js-score').html(`<span>Score: ${score}</span>`);
    $('.js-progress').html(`<span>Question ${current} of ${total}`);
  
    switch (page) {
      case 'intro':
        $('.js-intro').show();
        break;
      
      case 'question':
        html = this._generateQuestionHtml(question);
        $('.js-question').html(html);
        $('.js-question').show();
        $('.quiz-status').show();
        break;
  
      case 'answer':
        html = this._generateFeedbackHtml(feedback);
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
  }
}

// Put `store` in global scope for debugging.
let store;
let handler;

// On DOM Ready, instantiate all services and run startup methods
$(() => {
  const api = new Api();
  store = new Store();
  const renderer = new Renderer(store);
  handler = new Handler(store, renderer, api);

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
