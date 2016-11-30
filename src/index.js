'use strict';

const HandlerWrapper = require('wysknd-aws-lambda').HandlerWrapper;
const wrapper = new HandlerWrapper('greeter');

const greetingHandler = require('./handlers/greeting-handler');

/**
 * Sample handler that responds with user greetings.
 */
exports.greetingHandler = wrapper.wrap(greetingHandler, 'greeting');
