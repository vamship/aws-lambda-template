/* jshint node:true, expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _loggerProvider = require('wysknd-common').loggerProvider;
_loggerProvider.enableMock();

const _rewire = require('rewire');
const _testHelper = require('wysknd-test');
const LambdaWrapper = _testHelper.AwsLambdaWrapper;
const _testValueProvider = _testHelper.testValueProvider;
const _testUtils = _testHelper.utils;

let _greetingHandler = null;

describe('[greeting handler]', () => {
    const DEFAULT_LANGUAGE = 'english';
    const DEFAULT_FIRST_NAME = 'John';
    const DEFAULT_LAST_NAME = 'Doe';
    const DEFAULT_MIDDLE_NAME = 'Samuel';

    function _createWrapper(event, alias, config) {
        event = event || {};
        event.accountId = event.language || DEFAULT_LANGUAGE;
        event.user = event.user || {};
        event.user.firstName = event.user.firstName || DEFAULT_FIRST_NAME;
        event.user.lastName = event.user.lastName || DEFAULT_LAST_NAME;

        const contextInfo = {
            alias: alias
        };

        config = config || {};

        return new LambdaWrapper(_greetingHandler, event, contextInfo, config);
    }

    beforeEach(() => {
        _greetingHandler = _rewire('../../../src/handlers/greeting-handler');
    });

    describe('[input validation]', () => {

        it('should fail execution if a valid language is not specified', () => {
            const error = _testUtils.generateSchemaErrorPattern('language');

            _testValueProvider.allButString('').forEach((language) => {
                const wrapper = new LambdaWrapper(_greetingHandler, {
                    language: language
                });
                wrapper.testError(error);
            });
        });

        it('should fail execution if the event does not define a valid user object', () => {
            const error = _testUtils.generateSchemaErrorPattern('user');
            _testValueProvider.allButObject().forEach((user) => {
                const wrapper = new LambdaWrapper(_greetingHandler, {
                    language: DEFAULT_LANGUAGE,
                    user: user
                });
                wrapper.testError(error);
            });
        });

        it('should fail execution if the user object does not define a valid firstName property', () => {
            const error = _testUtils.generateSchemaErrorPattern('firstName');
            _testValueProvider.allButString('').forEach((firstName) => {
                const wrapper = new LambdaWrapper(_greetingHandler, {
                    language: DEFAULT_LANGUAGE,
                    user: {
                        firstName: firstName
                    }
                });
                wrapper.testError(error);
            });
        });

        it('should fail execution if the user object does not define a valid lastName property', () => {
            const error = _testUtils.generateSchemaErrorPattern('lastName');
            _testValueProvider.allButString('').forEach((lastName) => {
                const wrapper = new LambdaWrapper(_greetingHandler, {
                    language: DEFAULT_LANGUAGE,
                    user: {
                        firstName: DEFAULT_FIRST_NAME,
                        lastName: lastName
                    }
                });
                wrapper.testError(error);
            });
        });

        it('should fail execution if the user object defines a middleName property of the incorrect type', () => {
            const error = _testUtils.generateSchemaErrorPattern('middleName');
            _testValueProvider.allButSelected('null', 'undefined', 'string').forEach((middleName) => {
                const wrapper = new LambdaWrapper(_greetingHandler, {
                    language: DEFAULT_LANGUAGE,
                    user: {
                        firstName: DEFAULT_FIRST_NAME,
                        lastName: DEFAULT_LAST_NAME,
                        middleName: middleName
                    }
                });
                wrapper.testError(error);
            });
        });

        it('should fail execution if a supported language is not specified', () => {
            [ 'foo', 'bar', 'baz' ].forEach((language) => {
                const error = `[BadRequest] Language is not supported: ${language}`;
                const wrapper = new LambdaWrapper(_greetingHandler, {
                    language: language,
                    user: {
                        firstName: DEFAULT_FIRST_NAME,
                        lastName: DEFAULT_LAST_NAME
                    }
                });
                wrapper.testError(error);
            });
        });
    });

    describe('[execution]', () => {
        it('should invoke the callback with a greeting message in the specified language', () => {
            const doTest = (language, greetingPrefix) => {
                const firstName = 'Joe';
                const lastName = 'Shmoe';
                const wrapper = _createWrapper({
                    language: language,
                    user: {
                        firstName: firstName,
                        lastName: lastName
                    }
                }, 'dev');
                const expectedGreeting = `${greetingPrefix}, ${firstName} ${lastName}`;

                expect(wrapper.callback).to.not.have.been.called;
                wrapper.invoke();
                expect(wrapper.callback).to.have.been.calledOnce;
                expect(wrapper.callback).to.have.been.calledWith(null, expectedGreeting);
            };

            [
                { language: 'english', greetingPrefix: 'Hello' },
                { language: 'french', greetingPrefix: 'Bonjour' }
            ].forEach((item) => {
                doTest(item.language, item.greetingPrefix);
            });
        });

        it('should use the middle name in the greeting if one is specified', () => {
            const doTest = (language, greetingPrefix) => {
                const firstName = 'Joe';
                const lastName = 'Shmoe';
                const middleName = 'Francis';
                const wrapper = _createWrapper({
                    language: language,
                    user: {
                        firstName: firstName,
                        lastName: lastName,
                        middleName: middleName
                    }
                }, 'dev');
                const expectedGreeting = `${greetingPrefix}, ${firstName} ${middleName} ${lastName}`;

                expect(wrapper.callback).to.not.have.been.called;
                wrapper.invoke();
                expect(wrapper.callback).to.have.been.calledOnce;
                expect(wrapper.callback).to.have.been.calledWith(null, expectedGreeting);
            };

            [
                { language: 'english', greetingPrefix: 'Hello' },
                { language: 'french', greetingPrefix: 'Bonjour' }
            ].forEach((item) => {
                doTest(item.language, item.greetingPrefix);
            });
        });
    });
});
