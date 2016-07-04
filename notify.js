#!/usr/bin/nodejs

// time after which next alert will be sent
// email and slack webhook uri
const ttl = 7200;
const email = 'your@email.com';
const slackPath = '/services/xxx/xxx/xxx';

const exec = require('child_process').exec;
const http = require('http');
const https = require('https');

function addToStash(path) {
    var msg = JSON.stringify({'path': path, 'content': {}, 'expire': ttl});

    var options = {
        hostname: 'localhost',
        path: '/stashes',
        port: 4567,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(msg)
        }
    };

    var req = http.request(options, (res) => {
        // usefull for debug
        console.log('statusCode: ', res.statusCode);
    });

    req.on('error', (e) => {
        console.error(e);
    });

    req.write(msg);
    req.end();
}

function checkStash(result, callback) {
    var processed = false;
    var path = `${result.client.name}-${result.check.name}-${result.check.status}`;

    http.get('http://localhost:4567/stashes', (res) => {
        res.setEncoding('utf8');
        res.on('data', (data) => {

            data = JSON.parse(data);
            data.forEach((el) => {
                if (el.path === path) processed = true;
            });

            if (!processed) addToStash(path);
            callback(processed);
        });

        res.resume();
    }).on('error', (err) => {
        return console.error(err.message);
    });
}


var raw = '';
process.stdin.on('readable', () => {
    var chunk = process.stdin.read();
    if (chunk !== null) {
        raw += chunk;
    }
});

process.stdin.on('end', () => {
    var result = JSON.parse(raw);

    checkStash(result, (processed) => {
        // do not send new alert if already processed
        if (processed) return;

        var cmd = `echo "${result.check.output}" | mail -s Sensu ${email}`;
        exec(cmd, (err, stdout, stderr) => {
            if (err) return console.error(err);
        });

        var msg = JSON.stringify({'text': result.check.output});

        var options = {
            hostname: 'hooks.slack.com',
            path: slackPath,
            method: 'POST',
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(msg)
            }
        };

        var req = https.request(options, (res) => {
            // usefull for debug
            //console.log('statusCode: ', res.statusCode);
        });

        req.on('error', (e) => {
            console.error(e);
        });

        req.write(msg);
        req.end();
    });
});
