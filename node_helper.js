'use strict';

const NodeHelper = require('node_helper');
const PythonShell = require('python-shell');

var pythonStarted = false;

module.exports = NodeHelper.create({

    activateMonitor: function () {
        return;
        if (this.config.turnOffDisplay) {
            // Check if hdmi output is already on
            exec("/opt/vc/bin/tvservice -s").stdout.on("data", function(data) {
                if (data.indexOf("0x120002") !== -1)
                    exec("/opt/vc/bin/tvservice --preferred && chvt 6 && chvt 7", null);
            });
        }
    },

    deactivateMonitor: function () {
        return;
        if (this.config.turnOffDisplay) {
            exec("/opt/vc/bin/tvservice -o", null);
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
                self.log("motion detected");
                self.sendSocketNotification("motion-detected");
                self.activateMonitor();
            }
            if (message.hasOwnProperty("motion-stopped")) {
                self.log("motion stopped");
                self.sendSocketNotification("motion-stopped");
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
        }
        ;
    }

});
