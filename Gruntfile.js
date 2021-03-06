/* jshint node:true */
'use strict';

const _fs = require('fs');
const _folder = require('wysknd-lib').folder;
const _utils = require('wysknd-lib').utils;
const _lambdaConfig = require('./resources/lambda-config.json');
const _awsSdk = require('aws-sdk');

// Need to set project specific options here.
const AWS_PROFILE = '__aws_profile__';
const AWS_REGION = '__aws_region__';
const PROJECT_NAME = 'greeter';

const AWS_STACK_NAME = `${PROJECT_NAME}-stack`;
const AWS_BUCKET = `${PROJECT_NAME}`;
const CF_TEMPLATE_DIR = 'cf-templates';
const CF_TEMPLATE_NAME = `${PROJECT_NAME}-template.json`;

// -------------------------------------------------------------------------------
//  Help documentation
// -------------------------------------------------------------------------------
const HELP_TEXT =
'--------------------------------------------------------------------------------\n' +
' Defines tasks that are commonly used during the development process. This      \n' +
' includes tasks for linting, building and testing.                              \n' +
'                                                                                \n' +
' Supported Tasks:                                                               \n' +
'   [default]         : Performs standard pre-checkin activities. Runs           \n' +
'                       formatting on all source files, validates the files      \n' +
'                       (linting), and then executes tests against the files.    \n' +
'                                                                                \n' +
'   env               : Provides information regarding the current environment.  \n' +
'                       This an information only task that does not alter any    \n' +
'                       file/folder in the environment.                          \n' +
'                                                                                \n' +
'   help              : Shows this help message.                                 \n' +
'                                                                                \n' +
'   clean             : Cleans out all build artifacts and other temporary files \n' +
'                       or directories.                                          \n' +
'                                                                                \n' +
'   monitor:[opt1]:   : Monitors files for changes, and triggers actions based   \n' +
'           [opt2]:     on specified options. Supported options are as follows:  \n' +
'                         [lint]   : Performs linting with default options       \n' +
'                                    against all source files.                   \n' +
'                         [unit]   : Executes unit tests against all source      \n' +
'                                    files.                                      \n' +
'                                                                                \n' +
'                       Multiple options may be specified, and the triggers will \n' +
'                       be executed in the order specified. If a specific task   \n' +
'                       requires a web server to be launched, this will be done  \n' +
'                       automatically.                                           \n' +
'                                                                                \n' +
'   lint              : Performs linting of all source and test files.           \n' +
'                                                                                \n' +
'   format            : Formats source and test files.                           \n' +
'                                                                                \n' +
'   test:unit         : Executes unit tests against source files.                \n' +
'                                                                                \n' +
'   bump:[major|minor]: Updates the version number of the package. By default,   \n' +
'                       this task only increments the patch version number. Major\n' +
'                       and minor version numbers can be incremented by          \n' +
'                       specifying the "major" or "minor" subtask.               \n' +
'                                                                                \n' +
'  cf:[create|update| : Allows create, update, delete or display status on a     \n' +
'      delete|status]   cloud formation script associated with the project. Uses \n' +
'                       wysknd-aws-cf-generator to generate cloud formation      \n' +
'                       scripts.                                                 \n' +
'                                                                                \n' +
' Supported Options:                                                             \n' +
'   --unit-test-suite : Can be used to specify a unit test suite to execute when \n' +
'                       running tests. Useful when development is focused on a   \n' +
'                       small section of the app, and there is no need to retest \n' +
'                       all components when runing a watch.                      \n' +
'   --lambda-function : A regular expression that can be used to filter out      \n' +
'                       lambda functions when performing a deployment.           \n' +
'                                                                                \n' +
' IMPORTANT: Please note that while the grunt file exposes tasks in addition to  \n' +
' ---------  the ones listed below (no private tasks in grunt yet :( ), it is    \n' +
'            strongly recommended that just the tasks listed below be used       \n' +
'            during the dev/build process.                                       \n' +
'                                                                                \n' +
'--------------------------------------------------------------------------------';
module.exports = function(grunt) {
    /* ------------------------------------------------------------------------
     * Initialization of dependencies.
     * ---------------------------------------------------------------------- */
    //Time the grunt process, so that we can understand time consumed per task.
    require('time-grunt')(grunt);

    //Load all grunt tasks by reading package.json.
    require('load-grunt-tasks')(grunt);

    /* ------------------------------------------------------------------------
     * Build configuration parameters
     * ---------------------------------------------------------------------- */
    const packageConfig = grunt.file.readJSON('package.json') || {};

    const ENV = {
        appName: packageConfig.name || '__UNKNOWN__',
        appVersion: packageConfig.version || '__UNKNOWN__',
        tree: {                             /* ------------------------------ */
                                            /* <ROOT>                         */
            'src': null,                    /*  |--- src                      */
            'config': null,                 /*  |--- config                   */
            'test': {                       /*  |--- test                     */
                'unit': null                /*  |   |--- unit                 */
            },                              /*  |                             */
            'resources': {                  /*  |--- resources                */
                'cf': null,                 /*  |    | --- cf                 */
                'data': null                /*  |    | --- data               */
            },                              /*  |                             */
            'working': null,                /*  |--- working                  */
            'dist': null,                   /*  |--- dist                     */
            'coverage': null                /*  |--- coverage                 */
        }                                   /* ------------------------------ */
    };

    ENV.ROOT = _folder.createFolderTree('./', ENV.tree);

    // This is the root url prefix for the app, and represents the path
    // (relative to root), where the app will be available. This value should
    // remain unchanged for most apps, but can be tweaked here if necessary.
    ENV.appRoot = '/' + ENV.appName;
    (function _createTreeRefs(parent, subTree) {
        for(let folder in subTree) {
            const folderName = folder.replace('.', '_');
            parent[folderName] = parent.getSubFolder(folder);

            const children = subTree[folder];
            if(typeof children === 'object') {
                _createTreeRefs(parent[folder], children);
            }
        }
    })(ENV.ROOT, ENV.tree);

    // Shorthand references to key folders.
    const SRC = ENV.ROOT.src;
    const CONFIG = ENV.ROOT.config;
    const TEST = ENV.ROOT.test;
    const WORKING = ENV.ROOT.working;
    const DIST = ENV.ROOT.dist;
    const RESOURCES = ENV.ROOT.resources;

    /* ------------------------------------------------------------------------
     * Grunt task configuration
     * ---------------------------------------------------------------------- */
    grunt.initConfig({
        /**
         * Configuration for grunt-contrib-copy, which is used to:
         *  - Copy files to a distribution folder during build/packaging
         */
        copy: {
            compile: {
                files: [ {
                    expand: true,
                    cwd: SRC.getPath(),
                    src: ['**'],
                    dest: WORKING.getPath()
                }, {
                    expand: true,
                    cwd: ENV.ROOT.getPath(),
                    src: [ CONFIG.allFilesPattern('*') ],
                    dest: WORKING.getPath()
                }, {
                    expand: false,
                    cwd: ENV.ROOT.getPath(),
                    src: ['package.json'],
                    dest: WORKING.getPath()
                } ]
            }
        },

        /**
         * Configuration for grunt-contrib-clean, which is used to:
         *  - Remove temporary files and folders.
         */
        clean: {
            coverage: [ ENV.ROOT.coverage.getPath() ],
            working: [ WORKING.getPath() ],
            dist: [ DIST.getPath() ]
        },

        /**
         * Configuration for grunt-mocha-istanbul, which is used to:
         *  - Execute server side node.js tests, with code coverage
         */
        mocha_istanbul: {
            options: {
                reportFormats: [ 'text', 'html' ],
                reporter: 'spec',
                colors: true
            },
            default: [ TEST.unit.allFilesPattern('js') ]
        },

        /**
         * Configuration for lambda_package, which is a part of
         * grunt-aws-lamda. This task is used to:
         *  - Create a package for lambda deployment
         */
        lambda_package: {
            default: {
                options: {
                    package_folder: WORKING.getPath()
                }
            }
        },

        /**
         * Configuration for lambda_deploy, which is a part of
         * grunt-aws-lamda. This task is used to:
         *  - Deploy one or more lambda functions to the cloud
         */
        lambda_deploy: {
            default: {
                options: {
                    aliases: '',
                    enableVersioning: true
                },
                arn : ''
            }
        },


        /**
         * Configuration for grunt-jsbeautifier, which is used to:
         *  - Beautify all javascript, html and css files  prior to checkin.
         */
        jsbeautifier: {
            dev: [
                SRC.allFilesPattern('js'),
                RESOURCES.cf.allFilesPattern('js'),
                TEST.allFilesPattern('js')
            ]
        },

        /**
         * Configuration for grunt-contrib-jshint, which is used to:
         *  - Monitor all source/test files and trigger actions when these
         *    files change.
         */
        jshint: {
            options: {
                reporter: require('jshint-stylish'),
                esversion: 6,
                node: true,
                mocha: true,
                // This is because we are using Bluebird to override native
                // promise implementations, and that results in linting errors
                // for redefinition of "Promise"
                predef: [ "-Promise" ]
            },
            dev: [ 'Gruntfile.js',
                    SRC.allFilesPattern('js'),
                    RESOURCES.cf.allFilesPattern('js'),
                    TEST.allFilesPattern('js') ]
        },

        /**
         * Configuration for grunt-contrib-watch, which is used to:
         *  - Monitor all source/test files and trigger actions when these
         *    files change.
         */
        watch: {
            allSources: {
                files: [ SRC.allFilesPattern(), TEST.allFilesPattern() ],
                tasks: [ ]
            }
        },

        /**
         * Configuration for grunt-bump, which is used to:
         *  - Update the version number on package.json
         */
        bump: {
            options: {
                push: false
             }
        },

        /**
         * Configuration for grunt-contrib-wysknd-cloudformation, which is used
         * to:
         *  - Generate cloud formation JSON templates based on code driven
         *    specifications.
         */
        generate_cf_template: {
            options: {
                description: 'AWS resources for the thermal camera web portal',
                tokens: {
                    lambda_execute_role: `$REGION.${PROJECT_NAME}.lambda_role`
                },
                output: {
                    dir: DIST.getPath(),
                    fileName: CF_TEMPLATE_NAME
                },
                input: {
                    rootDir: RESOURCES.getPath(),
                    templateDir: 'cf'
                }
            }
        },

        /**
         * Configuration for grunt-aws-s3, which is used
         * to:
         *  - Upload resources to S3
         */
        aws_s3: {
            options: {
                awsProfile: AWS_PROFILE,
                bucket: AWS_BUCKET,
                region: AWS_REGION
            },
            uploadCf: {
                action: 'upload',
                expand: true,
                cwd: DIST.getPath(),
                dest: CF_TEMPLATE_DIR,
                src: CF_TEMPLATE_NAME,
                differential: true
            },
            uploadLambda: {
                action: 'upload',
                expand: true,
                cwd: DIST.getPath(),
                dest: CF_TEMPLATE_DIR,
                src: CF_TEMPLATE_NAME,
                differential: true
            }
        },

        /**
         * Configuration for grunt-aws-cloudformation, which is used
         * to:
         *  - Create and/or update stacks on cloudformation
         */
        cloudformation: {
            options: {
                stackName: AWS_STACK_NAME,
                region: AWS_REGION,
                profile: AWS_PROFILE,
                capabilities: [ 'CAPABILITY_NAMED_IAM' ]
            },
            status: {
                action: 'stack-status'
            },
            create: {
                action: 'create-stack',
                templateUrl: `https://s3.amazonaws.com/${AWS_BUCKET}/${CF_TEMPLATE_DIR}/${CF_TEMPLATE_NAME}`
            },
            update: {
                action: 'update-stack',
                templateUrl: `https://s3.amazonaws.com/${AWS_BUCKET}/${CF_TEMPLATE_DIR}/${CF_TEMPLATE_NAME}`
            },
            delete: {
                action: 'delete-stack'
            }
        }
    });

    /* ------------------------------------------------------------------------
     * Task registrations
     * ---------------------------------------------------------------------- */

    /**
     * Default task. Performs default tasks prior to checkin, including:
     *  - Beautifying files
     *  - Linting files
     *  - Building sources
     *  - Testing build artifacts
     *  - Cleaning up build results
     */
    grunt.registerTask('default', [ 'format',
                                    'lint',
                                    'test:unit',
                                    'clean' ]);

    /**
     * Create distribution package task. Creates a new distribution of the app,
     * ready for deployment.
     */
    grunt.registerTask('package', ['format',
                                 'lint',
                                 'build',
                                 'test:unit',
                                 'lambda_package',
                                 'clean:working' ]);

    /**
     * Create, update, delete or show status of the cloud formation resource
     * stack associated with the project.
     */
    grunt.registerTask('cf',
        'Enables create, update, delete or status check on a cloud formation stack associated with the project',
        function(target) {
            target = target || 'update';
            if(['update', 'create', 'delete', 'status'].indexOf(target) < 0) {
                grunt.log.error(`Invalid target specified: [${target}]`);
                return;
            }
            if(['update', 'create'].indexOf(target) >= 0) {
                grunt.task.run('generate_cf_template');
                grunt.task.run('aws_s3:uploadCf');
            }
            grunt.task.run(`cloudformation:${target}`);
        }
    );

    /**
     * Create distribution package and deploy it to AWS.
     */
    grunt.registerTask('deploy',
        'Prepares a package of the lambda functions, and deploys them all to the specified environment',
         function(target) {
            if(target !== 'prod') {
                target = 'dev';
            }
            grunt.task.run('package');
            grunt.task.run(`deploy_lambdas:${target}`);
         }
    );

    /**
     * Build task - performs a compilation on all source files
     *  - Copies all relevant files to the distribution directory
     */
    grunt.registerTask('build',
        'Performs a full build of all source files, preparing it for packaging/publication',
        function() {
            //This function could potentially do more at a later stage,
            //for example generating credential files for deployment
            //with lambdas, etc.

            grunt.task.run('clean:dist');
            grunt.task.run('clean:working');
            grunt.task.run('copy:compile');
        }
    );

    /**
     * Lambda deploy task. This task requires that the lambdas be
     * packaged using the lambda_package task.
     *  - Deploys all lambdas configured in lambda-config.json
     */
    grunt.registerTask('deploy_lambdas',
        'Deploys all defined lambda functions in the project',
        function(target, packageName) {
            if(target !== 'prod') {
                target = 'dev';
            }
            if(typeof packageName !== 'string' || packageName.length <= 0) {
                // Use the package name set by the default packaging task.
                packageName = grunt.config.get('lambda_deploy.default.package');
            }

            let functionNameFilter = grunt.option('lambda-function');
            if(typeof functionNameFilter !== 'string' ||
               functionNameFilter.length < 0)  {
                functionNameFilter = '.*';
            } else {
                grunt.log.writeln(`Filtering lambdas using regex pattern: [${functionNameFilter}]`);
            }
            functionNameFilter = new RegExp(functionNameFilter);

            const iam = new _awsSdk.IAM({
                credentials: new _awsSdk.SharedIniFileCredentials({
                    profile: AWS_PROFILE
                })
            });

            const done = this.async();
            iam.getUser((err, data) => {
                if(err) {
                    grunt.log.error(`Unable to extract AWS information for profile: [${AWS_PROFILE}]`);
                    done(false);
                    return;
                }
                grunt.log.writeln(`Deploying lambda functions to: [${target}]`);
                const accountId = data.User.Arn.split(':')[4];
                const arnPrefix = `arn:aws:lambda:${AWS_REGION}:${accountId}:function:`;
                _lambdaConfig.lambdas.forEach((config) => {
                    if(!functionNameFilter.test(config.functionName)) {
                        grunt.log.debug(`Skipping function: [${config.functionName}]`);
                        return;
                    }
                    const arn = `${arnPrefix}${config.functionName}`;
                    const handlerName = config.handlerName;
                    const taskName = config.functionName;

                    // Create a different task for each call, because the calls are
                    // asynchronous
                    grunt.config.set(`lambda_deploy.${taskName}.options.aliases`, target);
                    grunt.config.set(`lambda_deploy.${taskName}.options.enableVersioning`, true);
                    grunt.config.set(`lambda_deploy.${taskName}.options.region`, AWS_REGION);
                    grunt.config.set(`lambda_deploy.${taskName}.options.profile`, AWS_PROFILE);
                    grunt.config.set(`lambda_deploy.${taskName}.arn`, arn);
                    grunt.config.set(`lambda_deploy.${taskName}.package`, packageName);
                    grunt.task.run(`lambda_deploy:${taskName}`);
                });
                done();
            });
        }
    );

    /**
     * Test task - executes lambda tests against code in dev only.
     */
    grunt.registerTask('test',
        'Executes tests against sources',
        function(testType) {
            let testAction;

            if(testType === 'unit') {
                testAction = 'mocha_istanbul:default';
                const unitTestSuite = grunt.option('unit-test-suite');
                if(typeof unitTestSuite === 'string' && unitTestSuite.length > 0) {
                    grunt.log.writeln('Running test suite: ', unitTestSuite);
                    grunt.config.set('mocha_istanbul.default', TEST.unit.getChildPath(unitTestSuite));
                }
            }

            if(testAction) {
                grunt.task.run(testAction);
            } else {
                grunt.log.warn('Unrecognized test type. Please see help (grunt help) for task usage information');
            }
        }
    );


    // Monitor task - track changes on different sources, and enable auto
    // execution of tests if requested.
    //  - If arguments are specified (see help) execute the necessary actions
    //    on changes.
    grunt.registerTask('monitor',
        'Monitors source files for changes, and performs actions as necessary',
        function() {
            const tasks = [];

            // Process the arguments (specified as subtasks).
            Array.prototype.slice.call(arguments).forEach((arg, index) => {
                if (arg === 'lint') {
                    tasks.push('lint');

                } else if ('unit' === arg) {
                    tasks.push('test:unit');

                } else {
                    // Unrecognized argument.
                    console.warn('Unrecognized argument: %s', arg);
                }
            });

            if(tasks.length > 0) {
                grunt.config.set('watch.allSources.tasks', tasks);
                grunt.log.writeln('Tasks to run on change: [' + tasks + ']');
                grunt.task.run('watch:allSources');
            } else {
                grunt.log.writeln('No tasks specified to execute on change');
            }
        }
    );

    /**
     * Shows the environment setup.
     */
    grunt.registerTask('env',
        'Shows the current environment setup',
        function() {
            const separator = new Array(80).join('-');
            function _showRecursive(root, indent) {
                let indentChars = '  ';
                if(!indent) {
                    indent = 0;
                } else  {
                    indentChars += '|';
                }
                indentChars += new Array(indent).join(' ');
                indentChars += '|--- ';
                let hasChildren = false;
                for(let prop in root) {
                    const member = root[prop];
                    if(typeof member === 'object') {
                        const maxLen = 74 - (indentChars.length + prop.length);
                        const status = _utils.padLeft(member.getStatus(), maxLen);

                        grunt.log.writeln(indentChars + prop + status);
                        hasChildren = true;
                        if(_showRecursive(member, indent  + 4)) {
                            grunt.log.writeln('  |');
                        }
                    }
                }

                return hasChildren;
            }

            grunt.log.writeln('\n' + separator);
            _showRecursive(ENV.ROOT, 0);
            grunt.log.writeln(separator + '\n');
        }
    );

    /**
     * Lint task - checks source and test files for linting errors.
     */
    grunt.registerTask('lint', [ 'jshint:dev' ]);

    /**
     * Formatter task - formats all source and test files.
     */
    grunt.registerTask('format', [ 'jsbeautifier:dev' ]);

    /**
     * Shows help information on how to use the Grunt tasks.
     */
    grunt.registerTask('help',
        'Displays grunt help documentation',
        function(){
            grunt.log.writeln(HELP_TEXT);
        }
    );
};
