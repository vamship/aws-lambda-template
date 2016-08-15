'use strict';

const _argUtils = require('wysknd-common').argUtils;

const _schema = require('../schema/greeting-schema');
const _checkSchema = _argUtils.buildSchemaChecker(_schema);

const _greetingPrefixes = {
    'english': 'Hello',
    'french': 'Bonjour'
};

/**
 * AWS Lambda function handler that creates a new poll object.
 * 
 * @param {Object} event The lambda event object
 * @param {Object} context The lambda context object
 * @param {Function} callback A callback method to signal the completion
 *          lambda function
 * @param {Object} ext Extended properties containing references to injected
 *        properties such as config, logger, etc.
 */
module.exports = function(event, context, callback, ext) {
    const logger = ext.logger;
    const config = ext.config;
    let error = _checkSchema(event, callback);

    if (error) {
        logger.error(error);
        callback(error);
        return;
    }

    const greetingPrefix = _greetingPrefixes[event.language];
    if (!greetingPrefix) {
        error = new Error(`Language is not supported: ${event.language}`);
        logger.error(error);
        callback(error);
        return;
    }

    const user = event.user;
    if (typeof user.middleName !== 'string' || user.middleName.length <= 0) {
        user.middleName = ' ';
    } else {
        user.middleName = ` ${user.middleName} `;
    }

    callback(null, `${greetingPrefix}, ${user.firstName}${user.middleName}${user.lastName}`);
};
