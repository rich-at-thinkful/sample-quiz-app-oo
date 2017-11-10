'use strict';

class Api {
  constructor(){
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
      return callback();
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
  
  hasToken() {
    return this.sessionToken !== null;
  }
}

// Constant properties placed on the Api prototype (class), as they only need to be stored once, 
// but available to all class instances.
Api.prototype.BASE_API_URL = 'https://opentdb.com';

class Store {
  constructor() {
    this.setOrResetInitialStore();
  }

  _createQuestion(question) {
    return {
      text: question.question,
      answers: [ ...question.incorrect_answers, question.correct_answer ],
      correctAnswer: question.correct_answer
    };
  }

  _getQuestion(index) {
    return this._QUESTIONS[index];
  }

  // Public methods
  setOrResetInitialStore(apiReady = false) {
    for (const prop of Object.getOwnPropertyNames(this)) {
      delete this[prop];
    }
    this._QUESTIONS = [];
    this.page = 'intro';
    this.apiReady = apiReady;
    this.currentQuestionIndex = null;
    this.userAnswers = [];
    this.feedback = null;
  }

  getScore() {
    return this.userAnswers.reduce((accumulator, userAnswer, index) => {
      const question = this._getQuestion(index);
  
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
      total: this._QUESTIONS.length
    };
  }

  isLastQuestion(){
    return this.currentQuestionIndex ===this._QUESTIONS.length - 1;
  }

  seedQuestions(questions) {
    this._QUESTIONS.length = 0;
    questions.forEach(q => this._QUESTIONS.push(this._createQuestion(q)));
  }

  getCurrentQuestion() {
    return this._QUESTIONS[this.currentQuestionIndex];
  }
}

class Renderer {
  constructor(store, api) {
    this.store = store;
    this.api = api;
  }

  _hideAll() {
    this.TOP_LEVEL_COMPONENTS.forEach(component => $(`.${component}`).hide());
  }

  _generateAnswerItemHtml(answer) {
    return `
      <div class="answer-item">
        <input type="radio" name="answer" value="${answer}" id="${answer}" />
        <label for="${answer}" class="answer-text">${answer}</label>
      </div>
    `;
  }
  
  _generateQuestionHtml(question) {
    return `
      <form>
        <fieldset>
          <legend class="question-text">${question.text}</legend>
            ${question.answers.map((answer, index) => this._generateAnswerItemHtml(answer, index)).join('')}
          <button type="submit">Submit</button>
        </fieldset>
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

  _generateIntroHtml(apiReady) {
    return `
      Welcome to the quiz.
      <select id="js-question-quantity">
        <option value="3" selected>3 questions</option>
        <option value="10">10 questions</option>
        <option value="25">25 questions</option>
      </select>
      <button ${apiReady ? '' : 'disabled'} class="start js-start">Start Now</button>
    `;    
  }

  render() {
    let html;
    this._hideAll();
  
    const { feedback, page, apiReady } = this.store; 
    const question = this.store.getCurrentQuestion();
    const { current, total } = this.store.getProgress();
    const score = this.store.getScore();
  
    $('.js-score').html(`<span>Score: ${score}</span>`);
    $('.js-progress').html(`<span>Question ${current} of ${total}`);

    switch (page) {
      case 'intro':
        html = this._generateIntroHtml(apiReady);
        $('.js-intro').html(html);
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

  handleStartQuiz() {
    const apiReady = this.api.hasToken();
    this.store.setOrResetInitialStore(apiReady);
    const quantity = parseInt($('#js-question-quantity').find(':selected').val(), 10);

    this.api.fetchQuestions(quantity, { type: 'multiple' }, res => {
      if (res.response_code !== 0) {
        throw new Error(res);
      }

      this.store.page = 'question';
      this.store.currentQuestionIndex = 0;
      this.store.seedQuestions(res.results);
      this.render();
    });
  }

  handleSubmitAnswer(e) {
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
    this.render();
  }

  handleNextQuestion() {
    if (this.store.isLastQuestion()) {
      this.store.page = 'outro';
      this.render();
      return;
    }
  
    this.store.currentQuestionIndex++;
    this.store.page = 'question';
    this.render();
  }

  applyEventListeners() {
    $('.js-intro, .js-outro').on('click', '.js-start', () => this.handleStartQuiz());
    $('.js-question').on('submit', e => this.handleSubmitAnswer(e));
    $('.js-question-feedback').on('click', '.js-continue', () => this.handleNextQuestion());
  }
}

// Constant properties placed on the Renderer prototype (class), as they only need to be stored once, 
// but available to all class instances.
Renderer.prototype.TOP_LEVEL_COMPONENTS = [
  'js-intro', 'js-question', 'js-question-feedback', 
  'js-outro', 'js-quiz-status',
];


const api = new Api();
const store = new Store();
const renderer = new Renderer(store, api);

// On DOM Ready, instantiate all services and run startup methods
$(() => {
  // Run first render and add listeners
  renderer.render();
  renderer.applyEventListeners();
  
  api.fetchToken(() => {
    store.apiReady = true;
    renderer.render();
  });

});
