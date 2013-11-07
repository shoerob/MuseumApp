var app = (function () {
    'use strict';

    // global error handling
    var showAlert = function(message, title, callback) {
        navigator.notification.alert(message, callback || function () {
        }, title, 'OK');
    };
    var showError = function(message) {
        showAlert(message, 'Error occured');
    };
    window.addEventListener('error', function (e) {
        e.preventDefault();
        var message = e.message + "' from " + e.filename + ":" + e.lineno;
        showAlert(message, 'Error occured');
        return true;
    });

    var onBackKeyDown = function(e) {
        e.preventDefault();
        navigator.notification.confirm('Do you really want to exit?', function (confirmed) {
            var exit = function () {
                navigator.app.exitApp();
            };
            if (confirmed === true || confirmed === 1) {
                AppHelper.logout().then(exit, exit);
            }
        }, 'Exit', 'Ok,Cancel');
    };
    var onDeviceReady = function() {
        //Handle document events
        document.addEventListener("backbutton", onBackKeyDown, false);
    };

    document.addEventListener("deviceready", onDeviceReady, false);

    var applicationSettings = {
        emptyGuid: '00000000-0000-0000-0000-000000000000',
        apiKey: 'pxjW9x5tvwHdFXzI',
        scheme: 'http'
    };

    // initialize Everlive SDK
    var el = new Everlive({
        apiKey: applicationSettings.apiKey,
        scheme: applicationSettings.scheme
    });

    var facebook = new IdentityProvider({
        name: "Facebook",
        loginMethodName: "loginWithFacebook",
        endpoint: "https://www.facebook.com/dialog/oauth",
        response_type:"token",
        client_id: "622842524411586",
        redirect_uri:"https://www.facebook.com/connect/login_success.html",
        access_type:"online",
        scope:"email",
        display: "touch"
    });
    
    var AppHelper = {
        resolveProfilePictureUrl: function (id) {
            if (id && id !== applicationSettings.emptyGuid) {
                return el.Files.getDownloadUrl(id);
            }
            else {
                return 'styles/images/avatar.png';
            }
        },
        resolvePictureUrl: function (id) {
            if (id && id !== applicationSettings.emptyGuid) {
                return el.Files.getDownloadUrl(id);
            }
            else {
                return '';
            }
        },
        formatDate: function (dateString) {
            var date = new Date(dateString);
            var year = date.getFullYear().toString();
            var month = date.getMonth().toString();
            var day = date.getDate().toString();
            return day + '.' + month + '.' + year;
        },
        logout: function () {
            return el.Users.logout();
        }
    };

    var mobileApp = new kendo.mobile.Application(document.body, { transition: 'slide', layout: 'mobile-tabstrip' });

    var usersModel = (function () {
        var currentUser = kendo.observable({ data: null });
        var usersData;
        var loadUsers = function () {
            return el.Users.currentUser()
            .then(function (data) {
                var currentUserData = data.result;
                currentUserData.PictureUrl = AppHelper.resolveProfilePictureUrl(currentUserData.Picture);
                currentUser.set('data', currentUserData);
                return el.Users.get();
            })
            .then(function (data) {
                usersData = new kendo.data.ObservableArray(data.result);
            })
            .then(null,
                  function (err) {
                      showError(err.message);
                  }
            );
        };
        return {
            load: loadUsers,
            users: function () {
                return usersData;
            },
            currentUser: currentUser
        };
    }());

    // login view model
    var loginViewModel = (function () {
        var login = function () {
            var username = $('#loginUsername').val();
            var password = $('#loginPassword').val();

            el.Users.login(username, password)
            .then(function () {
                return usersModel.load();
            })
            .then(function () {
                mobileApp.navigate('views/exhibitsView.html');
            })
            .then(null,
                  function (err) {
                      showError(err.message);
                  }
            );
        };
        var loginWithFacebook = function() {
            mobileApp.showLoading();
            facebook.getAccessToken(function(token) {
                el.Users.loginWithFacebook(token)
                .then(function () {
                    return usersModel.load();
                })
                .then(function () {
                    mobileApp.hideLoading();
                    mobileApp.navigate('views/exhibitsView.html');
                })
                .then(null, function (err) {
                    mobileApp.hideLoading();
                    if (err.code = 214) {
                        showError("The specified identity provider is not enabled in the backend portal.");
                    }
                    else {
                        showError(err.message);
                    }
                });
            })
        } 
        return {
            login: login,
            loginWithFacebook: loginWithFacebook
        };
    }());

    // signup view model
    var singupViewModel = (function () {
        var dataSource;
        var signup = function () {
            dataSource.Gender = parseInt(dataSource.Gender);
            var birthDate = new Date(dataSource.BirthDate);
            if (birthDate.toJSON() === null)
                birthDate = new Date();
            dataSource.BirthDate = birthDate;
            Everlive.$.Users.register(
                dataSource.Username,
                dataSource.Password,
                dataSource)
            .then(function () {
                showAlert("Registration successful");
                mobileApp.navigate('#welcome');
            },
                  function (err) {
                      showError(err.message);
                  }
            );
        };
        var show = function () {
            dataSource = kendo.observable({
                Username: '',
                Password: '',
                DisplayName: '',
                Email: '',
                Gender: '1',
                About: '',
                Friends: [],
                BirthDate: new Date()
            });
            kendo.bind($('#signup-form'), dataSource, kendo.mobile.ui);
        };
        return {
            show: show,
            signup: signup
        };
    }());

    var exhibitsModel = (function () {
        var exhibitModel = {
            id: 'Id',
            fields: {
                Title: {
                    field: 'Title',
                    defaultValue: ''
                },
                Description: {
                    field: 'Description',
                    defaultValue: ''
                },
                Tag: {
                    field: 'Tag',
                    defaultValue: ''
                },
                CreatedAt: {
                    field: 'CreatedAt',
                    defaultValue: new Date()
                },
                UserId: {
                    field: 'Owner',
                    defaultValue: ''
                },
                
            },
            CreatedAtFormatted: function () {
                return AppHelper.formatDate(this.get('CreatedAt'));
            },
            //PictureUrl: function () {
            //    return AppHelper.resolvePictureUrl(this.get('Picture'));
            //},
            User: function () {
                var userId = this.get('UserId');
                var user = $.grep(usersModel.users(), function (e) {
                    return e.Id === userId;
                })[0];
                return user ? {
                    DisplayName: user.DisplayName,
                    PictureUrl: ''//AppHelper.resolveProfilePictureUrl(user.Picture)
                } : {
                    DisplayName: 'Anonymous',
                    PictureUrl: ''//AppHelper.resolveProfilePictureUrl()
                };
            }
        };
        var exhibitsDataSource = new kendo.data.DataSource({
            type: 'everlive',
            schema: {
                model: exhibitModel
            },
            transport: {
                // required by Everlive
                typeName: 'Exhibit'
            },
            change: function (e) {
                console.log(e.items.length);
                if (e.items && e.items.length > 0) {
                    $('#no-exhibits-span').hide();
                }
                else {
                    $('#no-exhibits-span').show();
                }
            },
            sort: { field: 'CreatedAt', dir: 'desc' }
        });
        return {
            exhibits: exhibitsDataSource
        };
    }());

    // exhibits view model
    var exhibitsViewModel = (function () {
        var exhibitSelected = function (e) {
            mobileApp.navigate('views/exhibitView.html?uid=' + e.data.uid);
        };
        var onAddArtifact = function (e) {
            mobileApp.navigate('views/addArtifactView.html?uid=' + e.data.uid);
/*            navigator.camera.getPicture(function(imageData) {
                mobileApp.navigate('views/addArtifactView.html?uid=' + e.data.uid + '?imgData=' + imageData);
            }, function(message) {
                
            }, { quality: 50 });*/
        };
        var navigateHome = function () {
            mobileApp.navigate('#welcome');
        };
        var logout = function () {
            AppHelper.logout()
            .then(navigateHome, function (err) {
                showError(err.message);
                navigateHome();
            });
        };
        return {
            exhibits: exhibitsModel.exhibits,
            exhibitSelected: exhibitSelected,
            onAddArtifact: onAddArtifact,
            logout: logout
        };
    }());

    // exhibit details view model
    var exhibitViewModel = (function () {
        return {
            show: function (e) {
                var exhibit = exhibitModel.exhibits.getByUid(e.view.params.uid);
                kendo.bind(e.view.element, exhibit, kendo.mobile.ui);
            }
        };
    }());

    // add exhibit view model
    var addExhibitViewModel = (function () {
        var $newTitle;
        var $newDesc;
        var $newTag;
        var titleValidator;
        var descValidator;
        var tagValidator;
        var init = function () {
            titleValidator = $('#enterTitle').kendoValidator().data("kendoValidator");
            $newTitle = $('#newTitle');
            descValidator = $('#enterDesc').kendoValidator().data("kendoValidator");
            $newDesc = $('#newDesc');
            tagValidator = $('#enterTag').kendoValidator().data("kendoValidator");
            $newTag = $('#newTag');
        };
        var show = function () {
            $newTitle.val('');
            titleValidator.hideMessages();
            $newDesc.val('');
            descValidator.hideMessages();
            $newTag.val('');
            tagValidator.hideMessages();
        };
        var saveExhibit = function () {
            if (titleValidator.validate() && descValidator.validate() && tagValidator.validate()) {
                var exhibits = exhibitsModel.exhibits;
                var exhibit = exhibits.add();
                exhibit.Title = $newTitle.val();
                exhibit.Description = $newDesc.val();
                exhibit.Tag = $newTag.val();
                exhibit.UserId = usersModel.currentUser.get('data').Id;
                exhibits.one('sync', function () {
                    mobileApp.navigate('#:back');
                });
                exhibits.sync();
            }
        };
        return {
            init: init,
            show: show,
            me: usersModel.currentUser,
            saveExhibit: saveExhibit
        };
    }());
    
    /**
     * Artifacts
     */
    var artifactsModel = (function () {
        var artifactModel = {
            id: 'Id',
            fields: {
                Title: {
                    field: 'Title',
                    defaultValue: ''
                },
                Description: {
                    field: 'Description',
                    defaultValue: ''
                },
                Tag: {
                    field: 'Tag',
                    defaultValue: ''
                },
                CreatedAt: {
                    field: 'CreatedAt',
                    defaultValue: new Date()
                },
                UserId: {
                    field: 'Owner',
                    defaultValue: ''
                },
                ExihibitId: {
                    field: 'ExihibitId',
                    defaultValue: ''
                }
                
            },
            CreatedAtFormatted: function () {
                return AppHelper.formatDate(this.get('CreatedAt'));
            },
            //PictureUrl: function () {
            //    return AppHelper.resolvePictureUrl(this.get('Picture'));
            //},
            User: function () {
                var userId = this.get('UserId');
                var user = $.grep(usersModel.users(), function (e) {
                    return e.Id === userId;
                })[0];
                return user ? {
                    DisplayName: user.DisplayName,
                    PictureUrl: ''//AppHelper.resolveProfilePictureUrl(user.Picture)
                } : {
                    DisplayName: 'Anonymous',
                    PictureUrl: ''//AppHelper.resolveProfilePictureUrl()
                };
            }
        };
        var artifactsDataSource = new kendo.data.DataSource({
            type: 'everlive',
            schema: {
                model: artifactModel
            },
            transport: {
                // required by Everlive
                typeName: 'Artifact'
            },
            change: function (e) {
                console.log(e.items.length);
                if (e.items && e.items.length > 0) {
                    $('#no-artifacts-span').hide();
                }
                else {
                    $('#no-artifacts-span').show();
                }
            },
            sort: { field: 'CreatedAt', dir: 'desc' }
        });
        return {
            artifacts: artifactsDataSource
        };
    }());

    // add artifact view model
    var addArtifactViewModel = (function () {
        var $exhibitId;
        var $newTitle;
        var $newDesc;
        var $newTag;
        var titleValidator;
        var descValidator;
        var tagValidator;
        var init = function () {
            titleValidator = $('#enterTitle').kendoValidator().data("kendoValidator");
            $newTitle = $('#newTitle');
            descValidator = $('#enterDesc').kendoValidator().data("kendoValidator");
            $newDesc = $('#newDesc');
            tagValidator = $('#enterTag').kendoValidator().data("kendoValidator");
            $newTag = $('#newTag');
        };
        var show = function (e) {
            $exhibitId = e.view.params.uid;
            $newTitle.val('');
            titleValidator.hideMessages();
            $newDesc.val('');
            descValidator.hideMessages();
            $newTag.val('');
            tagValidator.hideMessages();
        };
        var saveArtifact = function () {
            if (titleValidator.validate() && descValidator.validate() && tagValidator.validate()) {
                var artifacts = artifactsModel.artifacts;
                var artifact = artifacts.add();
                artifact.Title = $newTitle.val();
                artifact.Description = $newDesc.val();
                artifact.Tag = $newTag.val();
                artifact.UserId = usersModel.currentUser.get('data').Id;
                artifact.ExihibitId = $exhibitId;
                artifacts.one('sync', function () {
                    mobileApp.navigate('#:back');
                });
                artifacts.sync();
            }
        };
        return {
            init: init,
            show: show,
            me: usersModel.currentUser,
            saveArtifact: saveArtifact
        };
    }());
    
    
    return {
        viewModels: {
            login: loginViewModel,
            signup: singupViewModel,
            exhibits: exhibitsViewModel,
            exhibit: exhibitViewModel,
            addExhibit: addExhibitViewModel,
            addArtifact: addArtifactViewModel
        }
    };
}());