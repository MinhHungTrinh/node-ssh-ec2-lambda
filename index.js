exports.handler = async () => {
    const AWS = require('aws-sdk');
    const region = process.env.Region;
    const autoScalingGroupName = process.env.AutoscalingGroupName;
    const privateKeyName = process.env.PrivateKeyName;
    AWS.config.update({region:region});

    let asgProm = new Promise(function(resolve, reject) {
        var autoscaling = new AWS.AutoScaling();
        var params = {
            AutoScalingGroupNames: [
                autoScalingGroupName
            ]
        };
        autoscaling.describeAutoScalingGroups(params, function(err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else {
                var instances = data.AutoScalingGroups[0].Instances;
                if (instances.length) {
                    resolve(instances[0].InstanceId)
                }
            }

        });
    });

    let instanceId = await asgProm;
    if (instanceId) {
        console.log(instanceId);

        let ec2Prom = new Promise(function(resolve, reject) {
            var ec2 = new AWS.EC2();
            var params = {
                InstanceIds: [
                    instanceId
                ]
            };
            ec2.describeInstances(params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else {
                    resolve(data.Reservations[0].Instances[0].PrivateIpAddress);
                }

            });
        });

        let host = await ec2Prom;
        console.log(host);

        let ssmProm = new Promise(function(resolve, reject) {
            var ssm = new AWS.SSM();
            var params = {
                Name: privateKeyName, /* required */
                WithDecryption: true
            };
            ssm.getParameter(params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else {
                    resolve(data.Parameter.Value);
                }
            });
        });

        let pemfile = await ssmProm;

        const SSH = require('simple-ssh');
        const user = 'ec2-user';

        // all this config could be passed in via the event
        const ssh = new SSH({
            host: host,
            user: user,
            key: pemfile
        });

        let prom = new Promise(function(resolve, reject) {

            let ourout = "";

            ssh.exec('echo hello', {
                exit: function() {
                    ourout += "\nsuccessfully exited!";
                    resolve(ourout);
                },
                out: function(stdout) {
                    ourout += stdout;
                }
            }).start({
                success: function() {
                    console.log("successful connection!");
                },
                fail: function(e) {
                    console.log("failed connection, boo");
                    console.log(e);
                }
            });

        });

        const res = await prom;

        return {
            statusCode: 200,
            body: res,
        };
    }

    return {
        statusCode: 404,
        body: "not found",
    };
};
