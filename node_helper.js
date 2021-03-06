'use strict';

const NodeHelper = require('node_helper');
const PythonShell = require('python-shell');
const {exec} = require('child_process');

var pythonStarted = false;

module.exports = NodeHelper.create({

    start: function() {
        // there is no config at this time
        // this.activateMonitor();
    },

    logAndExec: function(command) {
        console.log("Executing: " + command);
        exec(command);
    },

    stop: function() {
        this.logAndExec("DISPLAY=:0 xset dpms 600 600 600");
    },

    activateMonitor: function() {
        if (this.config.turnOffDisplay) {
            if (this.deactivateMonitorTimeout != null) {
                clearTimeout(this.deactivateMonitorTimeout);
            }
            this.logAndExec("DISPLAY=:0 xset -dpms");
            this.logAndExec("DISPLAY=:0 xset dpms force on");
        }
    },

    deactivateMonitor: function() {
        const self = this;
        if (this.config.turnOffDisplay) {
            this.logAndExec("DISPLAY=:0 xset dpms " + this.config.stayAwakeAfterMotionStop + " " + this.config.stayAwakeAfterMotionStop + " " + this.config.stayAwakeAfterMotionStop);
            if (this.deactivateMonitorTimeout != null) {
                clearTimeout(this.deactivateMonitorTimeout);
            }
            this.deactivateMonitorTimeout = setTimeout(function() {
                self.logAndExec("DISPLAY=:0 xset dpms force off");
            }, this.config.stayAwakeAfterMotionStop * 1000);
        }
    },

    python_start: function() {
        const self = this;
        const pyshell = new PythonShell('modules/' + this.name + '/lib/mm/facerecognition.py', {
            mode: 'json',
            args: [JSON.stringify(this.config)]
        });

        pyshell.on('message', function(message) {

            if (message.hasOwnProperty('status')) {
                console.log("[" + self.name + "] " + message.status);
            }
            if (message.hasOwnProperty('login')) {
                console.log("[" + self.name + "] " + "User " + self.config.users[message.login.user - 1] + " with confidence " + message.login.confidence + " logged in.");
                self.sendSocketNotification('user', {
                    action: "login",
                    user: message.login.user - 1,
                    confidence: message.login.confidence
                });
            }
            if (message.hasOwnProperty('logout')) {
                console.log("[" + self.name + "] " + "User " + self.config.users[message.logout.user - 1] + " logged out.");
                self.sendSocketNotification('user', {action: "logout", user: message.logout.user - 1});
            }
            if (message.hasOwnProperty("motion-detected")) {
                console.log("motion detected");
                self.sendSocketNotification("MOTION_DETECTED", {});
                self.activateMonitor();
            }
            if (message.hasOwnProperty("motion-stopped")) {
                console.log("motion stopped");
                self.sendSocketNotification("MOTION_STOPPED", {});
                self.deactivateMonitor();
            }
        });

        pyshell.end(function(err) {
            if (err) throw err;
            console.log("[" + self.name + "] " + 'finished running...');
        });
    },

    // Subclass socketNotificationReceived received.
    socketNotificationReceived: function(notification, payload) {
        if (notification === 'CONFIG') {
            this.config = payload;
            if (!pythonStarted) {
                pythonStarted = true;
                this.python_start();
            }
            this.deactivateMonitor();
        }
    }

});
