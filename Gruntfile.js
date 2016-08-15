/* jshint node:true */
'use strict';

const _fs = require('fs');
const _folder = require('wysknd-lib').folder;
const _utils = require('wysknd-lib').utils;
const _lambdaConfig = require('./lambda-config.json');

//NOTE: This account id must be replaced with a valid account id for the project.
const AWS_ACCOUNT_ID = '__some_account_id';
const AWS_REGION = 'us-east-1';

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
'                       jsbeautifier on all source files, validates the files    \n' +
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
'                         [lint]   : Executes jshint with default options against\n' +
'                                    all source files.                           \n' +
'                         [unit]   : Executes unit tests against all source      \n' +
'                                    files.                                      \n' +
'                                                                                \n' +
'                       Multiple options may be specified, and the triggers will \n' +
'                       be executed in the order specified. If a specific task   \n' +
'                       requires a web server to be launched, this will be done  \n' +
'                       automatically.                                           \n' +
'                                                                                \n' +
'   jshint:dev        : Executes jshint against all source files.                \n' +
'                                                                                \n' +
'   test:unit         : Executes unit tests against source files.                \n' +
'                                                                                \n' +
'   bump:[major|minor]: Updates the version number of the package. By default,   \n' +
'                       this task only increments the patch version number. Major\n' +
'                       and minor version numbers can be incremented by          \n' +
'                       specifying the "major" or "minor" subtask.               \n' +
'                                                                                \n' +
' Supported Options:                                                             \n' +
'   --unitTestSuite   : Can be used to specify a unit test suite to execute when \n' +
'                       running tests. Useful when development is focused on a   \n' +
'                       small section of the app, and there is no need to retest \n' +
'                       all components when runing a watch.                      \n' +
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
            'working': null,                /*  |--- dist                     */
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
            dev: [ SRC.allFilesPattern('js') ]
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
    grunt.registerTask('default', [ 'jsbeautifier:dev',
                                    'jshint:dev',
                                    'test:unit',
                                    'clean' ]);

    /**
     * Create distribution package task. Creates a new distribution of the app,
     * ready for deployment.
     */
    grunt.registerTask('package', ['jsbeautifier:dev',
                                 'jshint:dev',
                                 'build',
                                 'test:unit',
                                 'lambda_package',
                                 'clean:working' ]);

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

            grunt.log.writeln(`Deploying lambda functions to: [${target}]`);
            const arnPrefix = _lambdaConfig.arnPrefix;
            _lambdaConfig.lambdas.forEach((config) => {
                const arn = `${arnPrefix}${config.functionName}`;
                const handlerName = config.handlerName;
                const taskName = config.functionName;

                // Create a different task for each call, because the calls are
                // asynchronous
                grunt.config.set(`lambda_deploy.${taskName}.options.memory`, config.memory);
                grunt.config.set(`lambda_deploy.${taskName}.options.timeout`, config.timeout);
                grunt.config.set(`lambda_deploy.${taskName}.options.subnetIds`, config.subnetIds);
                grunt.config.set(`lambda_deploy.${taskName}.options.securityGroupIds`, config.securityGroupIds);
                grunt.config.set(`lambda_deploy.${taskName}.options.aliases`, target);
                grunt.config.set(`lambda_deploy.${taskName}.options.enableVersioning`, true);
                grunt.config.set(`lambda_deploy.${taskName}.options.handler`, handlerName);
                grunt.config.set(`lambda_deploy.${taskName}.arn`, arn);
                grunt.config.set(`lambda_deploy.${taskName}.package`, packageName);
                grunt.task.run(`lambda_deploy:${taskName}`);
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
                const unitTestSuite = grunt.option('unitTestSuite');
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
                    tasks.push('jshint:dev');

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
     * Shows help information on how to use the Grunt tasks.
     */
    grunt.registerTask('help', 
        'Displays grunt help documentation',
        function(){
            grunt.log.writeln(HELP_TEXT);
        }
    );
};
