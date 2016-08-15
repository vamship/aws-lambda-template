'use strict';

const HandlerWrapper = require('wysknd-aws-lambda').HandlerWrapper;
const wrapper = new HandlerWrapper('aws_lambda_template');

const greetingHandler = require('./handlers/greeting-handler');

/**
 * Handler for creating new poll objects.
 */
exports.greetingHandler = wrapper.wrap(greetingHandler, 'greeting');
