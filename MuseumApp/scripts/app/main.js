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

    var museumId = applicationSettings.emptyGuid;
    
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
                museumsModel.museums.fetch(function(){
                    var museums = this.data();
                    var userId = usersModel.currentUser.get('data').Id;
                	var museum = $.grep(museums, function (e) {
                    	return e.UserId === userId;
                	})[0];
                    if(museum != undefined){
                        museumId = museum.Id;
                        mobileApp.navigate('views/exhibitsView.html?museumId=' + museumId);
                    }
                    else{
                        mobileApp.navigate('views/addMuseumView.html');
                    }
                });
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
                    museumsModel.museums.fetch(function(){
                        var museums = this.data();
                        var userId = usersModel.currentUser.get('data').Id;
                        var museum = $.grep(museums, function (e) {
                            return e.UserId === userId;
                        })[0];
                        if(museum != undefined){
                            museumId = museum.Id;
                        	mobileApp.navigate('views/exhibitsView.html?museumId=' + museumId);
                        }
                        else{
                            mobileApp.navigate('views/addMuseumView.html');
                        }
                    });
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
                mobileApp.navigate('views/addMuseumView.html');
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
    
    var museumsModel = (function () {
        var museumModel = {
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
            User: function () {
                var userId = this.get('UserId');
                var user = $.grep(usersModel.users(), function (e) {
                    return e.Id === userId;
                })[0];
                return user ? {
                    DisplayName: user.DisplayName,
                    PictureUrl: ''
                } : {
                    DisplayName: 'Anonymous',
                    PictureUrl: ''
                };
            }
        };
            
        var museumsDataSource = new kendo.data.DataSource({
            type: 'everlive',
            schema: {
                model: museumModel
            },
            transport: {
                // required by Everlive
                typeName: 'Museum'
            },
            change: function (e) {
            },
            sort: { field: 'CreatedAt', dir: 'desc' }
        });
        return {
            museums: museumsDataSource
        };
    }());
    
    // add museum view model
    var addMuseumViewModel = (function () {
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
        var saveMuseum = function () {
            if (titleValidator.validate() && descValidator.validate() && tagValidator.validate()) {
                var museums = museumsModel.museums;
                var museum = museums.add();
                museum.Title = $newTitle.val();
                museum.Description = $newDesc.val();
                museum.Tag = $newTag.val();
                museum.UserId = usersModel.currentUser.get('data').Id;
                museums.one('sync', function () {
                   mobileApp.navigate('views/exhibitsView.html');
                });
                museums.sync();
                //todo: how to get id of newly created museum?
            }
        };
        return {
            init: init,
            show: show,
            me: usersModel.currentUser,
            saveMuseum: saveMuseum
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
                MuseumId: {
                    field: 'MuseumId',
                    defaultValue: applicationSettings.emptyGuid
                },
                IsPublic:{
                    field: 'IsPublic',
                    defaultValue: false
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
        var filteredExhibits;
        
        var init = function(e){
            //var museumId = e.sender.params.museumId;

            //exhibitsModel.exhibits.filter( { field: "MuseumId", operator: "eq", value: museumId });
            //exhibitsModel.exhibits.fetch(function(){
            //    var data = this.data();
            //    filteredExhibits = $.grep(data, function (e) {
            //    	return e.MuseumId === museumId;
            //	});                                        
            //});;
        };
        var exhibitSelected = function (e) {
            mobileApp.navigate('views/artifactsView.html?exhibitId=' + e.data.Id);
            //mobileApp.navigate('views/exhibitView.html?uid=' + e.data.uid);
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
            init: init,
            logout: logout
        };
    }());

    // exhibit details view model
    var exhibitViewModel = (function () {
        return {
            show: function (e) {
                var exhibit = exhibitModel.exhibits.getByUid(e.view.params.uid);
                alert(e.view.params.uid);
                alert(exhibit.Title);
                kendo.bind(e.view.element, exhibit, kendo.mobile.ui);
            }
        };
    }());

    // add exhibit view model
    var addExhibitViewModel = (function () {
        var $newTitle;
        var $newDesc;
        var $newTag;
        var $newPublic;
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
            $newPublic = $('#newPublic');
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
                exhibit.IsPublic = $newPublic.is(':checked');
                exhibit.UserId = usersModel.currentUser.get('data').Id;
                exhibit.MuseumId = museumId;
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
                },
                Image: {
                    field: 'Image',
                    defaultValue: applicationSettings.emptyGuid
                }
                
            },
            CreatedAtFormatted: function () {
                return AppHelper.formatDate(this.get('CreatedAt'));
            },
            PictureUrl: function () {
                return AppHelper.resolvePictureUrl(this.get('Image'));
            },
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

    // exhibits view model
    var artifactsViewModel = (function () {
        var $hamsterJuice; // it's like a monster energy drink, but it's not!
        var filteredArtifacts;
        
        var init = function(e){
            var exhibitId = e.sender.params.exhibitId;

            artifactsModel.artifacts.filter( { field: "ExihibitId", operator: "eq", value: exhibitId });
            artifactsModel.artifacts.fetch(function(){
                var data = this.data();
               	filteredArtifacts = $.grep(data, function (e) {
                	return e.ExihibitId === exhibitId;
            	});
            	console.log(filteredArtifacts);                                        
            });
        }
        var onAddArtifact = function (e) {
            $hamsterJuice = e.data.Id;
            navigator.camera.getPicture(function(imageData) {
                
                setTimeout(function() {
                    //alert.show(imageData);
                    mobileApp.navigate('views/addArtifactView.html?uid=' + $hamsterJuice + '&imgData=' + imageData);                    
                }, 1);
            }, function(message) {
                setTimeout(function() {
                    alert.show("Failure.");
                });
            }, { quality: 50 });
        };
        var artifactSelected = function (e) {
            mobileApp.navigate('views/artifactView.html?uid=' + e.data.uid);
        };
        var navigateHome = function () {
            mobileApp.navigate('#welcome');
        };
        var back = function() {
            artifactsModel.artifacts.filter([]);
            mobileApp.navigate('views/exhibitsView.html?museumId=' + museumId);
        }
        var logout = function () {
            AppHelper.logout()
            .then(navigateHome, function (err) {
                showError(err.message);
                navigateHome();
            });
        };
        return {
            artifacts: artifactsModel.artifacts,
            init: init,
            onAddArtifact: onAddArtifact,
            artifactSelected: artifactSelected,
            back: back,
            logout: logout
        };
    }());
    
    // add artifact view model
    var addArtifactViewModel = (function () {
        var $exhibitId;
        var $newTitle;
        var $newDesc;
        var $newTag;
        var $imgData;
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
            $imgData = e.view.params.imgData;
            $newTitle.val('');
            titleValidator.hideMessages();
            $newDesc.val('');
            descValidator.hideMessages();
            $newTag.val('');
            tagValidator.hideMessages();
        };
        var saveArtifact = function () {
            if (titleValidator.validate() && descValidator.validate() && tagValidator.validate()) {
                
                // upload teh file
                var imageURI = $imgData;
                // the retrieved URI of the file, e.g. using navigator.camera.getPicture()
                var uploadUrl = Everlive.$.Files.getUploadUrl();
                var options = new FileUploadOptions();
                options.fileKey = "file";
                options.fileName = "artifact.png";
                options.mimeType="image/png";
                options.headers = Everlive.$.buildAuthHeader();
                var ft = new FileTransfer();
                ft.upload(imageURI, uploadUrl,  function (r) {
                        //alert($imgData);
                        //alert("Success: " + JSON.stringify(r));
                        
                        var artifacts = artifactsModel.artifacts;
                        var artifact = artifacts.add();
                        artifact.Title = $newTitle.val();
                        artifact.Description = $newDesc.val();
                        artifact.Tag = $newTag.val();
                        artifact.UserId = usersModel.currentUser.get('data').Id;
                        artifact.ExihibitId = $exhibitId;
                    	artifact.Image = r.Id;  // THIS NO WORKIE!!!!! WHaaaaaaa!
                        artifacts.one('sync', function () {
                            mobileApp.navigate('#:back');
                        });
                        artifacts.sync();
                
                },  function(error){
                    alert("An error has occurred: Code = " + error.code);
                }, options);
            }
        };
        return {
            init: init,
            show: show,
            me: usersModel.currentUser,
            saveArtifact: saveArtifact
        };
    }());
        
        /*
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
    */
    
    return {
        viewModels: {
            login: loginViewModel,
            signup: singupViewModel,
            addMuseum: addMuseumViewModel,
            exhibits: exhibitsViewModel,
            exhibit: exhibitViewModel,
            addExhibit: addExhibitViewModel,
            artifacts: artifactsViewModel,
            addArtifact: addArtifactViewModel
        }
    };
}());
