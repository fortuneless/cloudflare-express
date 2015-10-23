var range_check = require('range_check');
var needle = require('needle');
var cf_ips = {
	ip4: [],
	ip6: []
};

needle.get('https://www.cloudflare.com/ips-v4', function(error, response) {
	if (error) {
		throw "Unable to access CloudFlare!";
	}
	cf_ips.ip4 = response.body.split("\n");
});

needle.get('https://www.cloudflare.com/ips-v6', function(error, response) {
	if (error) {
		throw "Unable to access CloudFlare!";
	}
	cf_ips.ip6 = response.body.split("\n");
});

function cloudflareExpress() {
	this.restore = function(options = {}){
		return function(req,res,next){
			if (cf_ips.ip4.length === 0 || cf_ips.ip6.length === 0) {
				if (options.error) {
					options.error(req, res, next);
				}
				return res.set({
					'Retry-After': 1
				}).status(503).json({
					error: {
						status: 503,
						title: "Waiting for CloudFlare",
						detail: "A request for the up-to-date CloudFlare IP address ranges is still processing. Please try this requestion again."
					}
				});
			}
			var remoteIP = {
				ip: req.ip, // app.set trust proxy could potentially modify this and cause issues
				protocol: req.protocol,
				v: "ip" + range_check.ver(req.ip)
			};
			if (req.headers['cf-connecting-ip'] == undefined){
				return next(); //no cloudflare IP, continue on like this never happened. Shhhh!
			}
			if (range_check.in_range(remoteIP.ip, cf_ips[remoteIP.v])){
				req.cf_ip = remoteIP.ip;
				req.cf_protocol = remoteIP.protocol;
				req.ip = req.headers['cf-connecting-ip'];
				req.protocol = JSON.parse(req.headers["cf-visitor"])["scheme"];
			}
			next();
		};
	};
}
module.exports = new cloudflareExpress();