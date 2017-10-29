const TOP_LEVEL_COMPONENTS = [
  'js-intro', 'js-question', 'js-question-feedback', 
  'js-outro', 'js-quiz-status',
];

// Create an Api class and immediately instantiate it into a global `api` variable
// We don't need the class exposed as we are not instantiating more than one Api
// but we're using a closure to keep some data private.
const api = function(){
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

  return new Api();
}();

// Create a Store class and immediately instantiate it into a global `store` variable
// We don't need the class exposed as we are not instantiating more than one Store
// but we're using a closure to keep some data private.
const store = function(){

  // Private variables
  const QUESTIONS = [];
  const createQuestion = function(question) {
    return {
      text: question.question,
      answers: [ ...question.incorrect_answers, question.correct_answer ],
      correctAnswer: question.correct_answer
    };
  };

  const hideAll = function() {
    TOP_LEVEL_COMPONENTS.forEach(component => $(`.${component}`).hide());
  };

  const getQuestion = function(index) {
    return QUESTIONS[index];
  };

  class Store {
    // Quasi-private methods - we prefix with underscore to indicate they are only intended for
    // use from within other store methods. They ARE visible on the `store` instance, though.
    // These method types are useful when you need access to other props on the store from
    // within the method.
    _getScore() {
      return this.userAnswers.reduce((accumulator, userAnswer, index) => {
        const question = getQuestion(index);
    
        if (question.correctAnswer === userAnswer) {
          return accumulator + 1;
        } else {
          return accumulator;
        }
      }, 0);
    }

    _getProgress() {
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

    render() {
      let html;
      hideAll();
    
      const { feedback, page } = this; 
      const question = this.getCurrentQuestion();
      const { current, total } = this._getProgress();
      const score = this._getScore();
    
      $('.js-score').html(`<span>Score: ${score}</span>`);
      $('.js-progress').html(`<span>Question ${current} of ${total}`);
    
      switch (page) {
        case 'intro':
          $('.js-intro').show();
          break;
        
        case 'question':
          html = Templates.generateQuestionHtml(question);
          $('.js-question').html(html);
          $('.js-question').show();
          $('.quiz-status').show();
          break;
    
        case 'answer':
          html = Templates.generateFeedbackHtml(feedback);
          $('.js-question-feedback').html(html);
          $('.js-question-feedback').show();
          $('.quiz-status').show();
          break;
    
        case 'outro':
          $('.js-outro').show();
          $('.quiz-status').show();
          break;
      }
    }
  }
  return new Store();
}();

// Plain old object for grouping Template functions. The methods don't depending on 
// their own context objects and are only passed data for rendering HTML.
const Templates = {
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

// Plain old object for grouping Event Handler functions. Each method is using the
// global api and/or store instances and isn't depending on its own context object.
const Handlers = {
  startQuiz() {
    store.setInitialStore();
    const quantity = parseInt($('#js-question-quantity').find(':selected').val(), 10);

    api.fetchQuestions(quantity, { type: 'multiple' }, res => {
      if (res.response_code !== 0) {
        throw new Error(res);
      }

      store.page = 'question';
      store.currentQuestionIndex = 0;
      store.seedQuestions(res.results);
      store.render();
    });
  },

  submitAnswer(e) {
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
    store.render();
  },

  nextQuestion() {
    if (store.isLastQuestion()) {
      store.page = 'outro';
      store.render();
      return;
    }
  
    store.currentQuestionIndex++;
    store.page = 'question';
    store.render();
  }
};

// On DOM Ready, run render() and add event listeners
$(() => {
  // Run first render
  store.setInitialStore();
  store.render();

  api.fetchToken(() => {
    $('.js-start').attr('disabled', false);
  });

  $('.js-intro, .js-outro').on('click', '.js-start', Handlers.startQuiz);
  $('.js-question').on('submit', Handlers.submitAnswer);
  $('.js-question-feedback').on('click', '.js-continue', Handlers.nextQuestion);
});
