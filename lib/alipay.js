var AlipayNotify = require('./alipay_notify.class').AlipayNotify;    
var AlipaySubmit = require('./alipay_submit.class').AlipaySubmit;
var assert = require('assert');
var url = require('url');
var inherits = require('util').inherits,
    EventEmitter = require('events').EventEmitter;
var DOMParser = require('xmldom').DOMParser;

var default_alipay_config = require('./alipay.defconfig.js');
			
function Alipay(alipay_config){		
	EventEmitter.call(this);
	//default config
	this.alipay_config = default_alipay_config;
	//config merge
	for(var key in alipay_config){
		this.alipay_config[key] = alipay_config[key];
	}
}
inherits(Alipay, EventEmitter);

/**
 * 路由映射
 * @ignore
 */
Alipay.prototype.route = function(app){
	var self = this;
	//即时到帐交易接口
	app.get(this.alipay_config.create_direct_pay_by_user_return_url, self.create_direct_pay_by_user_return.bind(self));
	app.post(this.alipay_config.create_direct_pay_by_user_notify_url, self.create_direct_pay_by_user_notify.bind(self));
	//即时到账批量退款有密接口
	app.post(this.alipay_config.refund_fastpay_by_platform_pwd_notify_url, self.refund_fastpay_by_platform_pwd_notify.bind(self));
	//纯担保交易接口接口
	app.get(this.alipay_config.create_partner_trade_by_buyer_return_url, self.create_partner_trade_by_buyer_return.bind(self));
	app.post(this.alipay_config.create_partner_trade_by_buyer_notify_url, self.create_partner_trade_by_buyer_notify.bind(self));
	//支付宝标准双接口
	app.get(this.alipay_config.trade_create_by_buyer_return_url, self.trade_create_by_buyer_return.bind(self));
	app.post(this.alipay_config.trade_create_by_buyer_notify_url, self.trade_create_by_buyer_notify.bind(self));
};

//----------------------------------------【支付宝即时到帐交易接口】
//发起一个请求（HTML提交方式）
/*data{
 out_trade_no:'' //商户订单号, 商户网站订单系统中唯一订单号，必填
 ,subject:'' //订单名称 必填
 ,total_fee:'' //付款金额,必填
 ,body:'' //订单描述
 ,show_url:'' //商品展示地址 需以http://开头的完整路径，例如：http://www.xxx.com/myorder.html
 }*/
Alipay.prototype.create_direct_pay_by_user = function(data, res){
	//assert.ok(data.out_trade_no && data.subject && data.total_fee);
	//建立请求
	var alipaySubmit = new AlipaySubmit(this.alipay_config);
	var parameter = {
		service: 'create_direct_pay_by_user',
		partner: this.alipay_config.partner,
		payment_type: '1', //支付类型
		notify_url: url.resolve(this.alipay_config.host, this.alipay_config.create_direct_pay_by_user_notify_url), //服务器异步通知页面路径,必填，不能修改, 需http://格式的完整路径，不能加?id=123这类自定义参数
		return_url: url.resolve(this.alipay_config.host , this.alipay_config.create_direct_pay_by_user_return_url), //页面跳转同步通知页面路径 需http://格式的完整路径，不能加?id=123这类自定义参数，不能写成http://localhost/
		seller_email: this.alipay_config.seller_email, //卖家支付宝帐户 必填		
		_input_charset: this.alipay_config['input_charset'].toLowerCase().trim()
	};
	for(var key in data){
		parameter[key] = data[key];
	}
	var html_text = alipaySubmit.buildRequestForm(parameter, "get", "手动提交");
	res.send(html_text);
};
//服务器异步通知[处理函数]
Alipay.prototype.create_direct_pay_by_user_notify = function (req, res) {
	var self = this;
	var _POST = req.body;
	//计算得出通知验证结果
	var alipayNotify = new AlipayNotify(this.alipay_config);
	//验证消息是否是支付宝发出的合法消息
	alipayNotify.verifyNotify(_POST, function (verify_result) {
		if(verify_result) {//验证成功
			//商户订单号
			var out_trade_no = _POST['out_trade_no'];
			//支付宝交易号
			var trade_no = _POST['trade_no'];
			//交易状态
			var trade_status = _POST['trade_status'];
			if (trade_status  == 'TRADE_FINISHED') {                
				self.emit('create_direct_pay_by_user_trade_finished', out_trade_no, trade_no);
			} else if (trade_status == 'TRADE_SUCCESS') {                
				self.emit('create_direct_pay_by_user_trade_success', out_trade_no, trade_no);
			}
			res.send("success"); //请不要修改或删除
		} else {
			//验证失败
			self.emit("verify_fail", _POST, 'create_direct_pay_by_user_notify');
			res.send("fail");
		}
	});	
};
//页面跳转同步通知[处理函数]
//【注：这里应该返回一个HTML页面，让用户看见支付结果】
Alipay.prototype.create_direct_pay_by_user_return = function (req, res) {
	var self = this;
	var _GET = req.query;
	//计算得出通知验证结果
	var alipayNotify = new AlipayNotify(this.alipay_config);
	alipayNotify.verifyReturn(_GET, function (verify_result) {
		var html = '<html><head><title>支付结果</title><script>[SCRIPT]</script></head><body>[BODY]</body></html>'; //ws=
		if(verify_result) {//验证成功
			//商户订单号
			var out_trade_no = _GET['out_trade_no'];
			//支付宝交易号
			var trade_no = _GET['trade_no'];
			//交易状态
			var trade_status = _GET['trade_status'];
			if (trade_status  == 'TRADE_FINISHED') {
				//判断该笔订单是否在商户网站中已经做过处理
					//如果没有做过处理，根据订单号（out_trade_no）在商户网站的订单系统中查到该笔订单的详细，并执行商户的业务程序
					//如果有做过处理，不执行商户的业务程序
						
				//注意：
				//该种交易状态只在两种情况下出现
				//1、开通了普通即时到账，买家付款成功后。
				//2、开通了高级即时到账，从该笔交易成功时间算起，过了签约时的可退款时限（如：三个月以内可退款、一年以内可退款等）后。
				self.emit('create_direct_pay_by_user_trade_finished', out_trade_no, trade_no);
			} else if (trade_status == 'TRADE_SUCCESS') {
				//判断该笔订单是否在商户网站中已经做过处理
					//如果没有做过处理，根据订单号（out_trade_no）在商户网站的订单系统中查到该笔订单的详细，并执行商户的业务程序
					//如果有做过处理，不执行商户的业务程序
						
				//注意：
				//该种交易状态只在一种情况下出现——开通了高级即时到账，买家付款成功后。
				self.emit('create_direct_pay_by_user_trade_success', out_trade_no, trade_no);
			}
			//ws->
			var count = 3;
			res.send(html
				.replace('[SCRIPT]', 'var count = ' + count + '; setInterval(function () { document.getElementById("count").innerHTML = count; if (count-- <= 0) { window.close(); } }, 1000);')
				.replace('[BODY]', '<div style="font-size:18px;font-family:\'微软雅黑\';"><b style="color:red;">恭喜！支付成功</b>！该页面将于 <span id="count" style="color:red;">' + count + '</span> 秒钟后自动关闭</div>')
			);
			//<-ws
		} else {
			//验证失败
			self.emit("verify_fail", _GET, 'create_direct_pay_by_user_return');
			//ws->
			res.send(html
				.replace('[SCRIPT]', '')
				.replace('[BODY]', '<div style="font-size:18px;font-family:\'微软雅黑\';">对不起！结果验证失败，请联系管理员</div>')
			);
			//<-ws
		}
	});
};

//----------------------------------------【即时到账批量退款有密接口】
//发起一个请求
/* 	data{
	refund_date:'',//退款当天日期, 必填，格式：年[4位]-月[2位]-日[2位] 小时[2位 24小时制]:分[2位]:秒[2位]，如：2007-10-01 13:13:13
	batch_no: '', //批次号, 必填，格式：当天日期[8位]+序列号[3至24位]，如：201008010000001
	batch_num:'', //退款笔数, 必填，参数detail_data的值中，“#”字符出现的数量加1，最大支持1000笔（即“#”字符出现的数量999个）
	detail_data: '',//退款详细数据 必填，具体格式请参见接口技术文档
} */
Alipay.prototype.refund_fastpay_by_platform_pwd = function (data, res) {
	assert.ok(data.refund_date && data.batch_no && data.batch_num && data.detail_data);
	//建立请求
	var alipaySubmit = new AlipaySubmit(this.alipay_config);
	//构造要请求的参数数组，无需改动
	var parameter = {
		service: 'refund_fastpay_by_platform_pwd',
		partner: this.alipay_config.partner,
		notify_url: url.resolve(this.alipay_config.host, this.alipay_config.refund_fastpay_by_platform_pwd_notify_url),
		seller_email: this.alipay_config.seller_email,
		
		refund_date: data.refund_date,
		batch_no: data.batch_no,
		batch_num: data.batch_num,
		detail_data: data.detail_data,
		
		_input_charset: this.alipay_config['input_charset'].toLowerCase().trim()
	};
	var html_text = alipaySubmit.buildRequestForm(parameter,"get", "确认");
	res.send(html_text);
};
//服务器异步通知[处理函数]
Alipay.prototype.refund_fastpay_by_platform_pwd_notify = function (req, res) {
	var self = this;
	var _POST = req.body;
	//计算得出通知验证结果
	var alipayNotify = new AlipayNotify(this.alipay_config);
	//验证消息是否是支付宝发出的合法消息
	alipayNotify.verifyNotify(_POST, function (verify_result) {
		if(verify_result) {//验证成功
			//批次号
			var batch_no = _POST['batch_no'];
			//批量退款数据中转账成功的笔数
			var success_num = _POST['success_num'];
			//批量退款数据中的详细信息
			var result_details = _POST['result_details'];
			self.emit('refund_fastpay_by_platform_pwd_success', batch_no, success_num, result_details);
			res.send("success");		//请不要修改或删除
		} else {
			 //验证失败
			self.emit("verify_fail", _POST, 'refund_fastpay_by_platform_pwd_notify');
			res.send("fail");
		}
	});
};

//----------------------------------------【支付宝纯担保交易接口】
//发起一个请求
Alipay.prototype.create_partner_trade_by_buyer = function (data, res) {
	//建立请求
	var alipaySubmit = new AlipaySubmit(this.alipay_config);
	//构造要请求的参数数组，无需改动
	var parameter = {
		service: 'create_partner_trade_by_buyer',
		partner: this.alipay_config.partner,
		payment_type: '1',
		notify_url: url.resolve(this.alipay_config.host, this.alipay_config.create_partner_trade_by_buyer_notify_url),
		return_url: url.resolve(this.alipay_config.host , this.alipay_config.create_partner_trade_by_buyer_return_url),
		seller_email: this.alipay_config.seller_email, 
		
		out_trade_no: data.out_trade_no,
		subject: data.subject,
		price: data.price,
		quantity: data.quantity,
		logistics_fee: data.logistics_fee,
		logistics_type: data.logistics_type,
		logistics_payment: data.logistics_payment,
		body: data.body,
		show_url: data.show_url,
		receive_name: data.receive_name,
		receive_address: data.receive_address,
		receive_zip: data.receive_zip,
		receive_phone: data.receive_phone,
		receive_mobile: data.receive_mobile,
		
		_input_charset: this.alipay_config['input_charset'].toLowerCase().trim()
	};
	var html_text = alipaySubmit.buildRequestForm(parameter,"get", "确认");
	res.send(html_text);
};
//页面跳转同步通知[处理函数]
Alipay.prototype.create_partner_trade_by_buyer_return = function (req, res) {
	var self = this;
	var _GET = req.query;
	//计算得出通知验证结果
	var alipayNotify = new AlipayNotify(this.alipay_config);
	//验证消息是否是支付宝发出的合法消息
	alipayNotify.verifyReturn(_GET, function (verify_result) {
		if (verify_result) {//验证成功
			//商户订单号
			var out_trade_no = _GET['out_trade_no'];
			//支付宝交易号
			var trade_no = _GET['trade_no'];
			//交易状态
			var trade_status = _GET['trade_status'];
			
			if (trade_status  == 'WAIT_BUYER_PAY') {                
				self.emit('create_partner_trade_by_buyer_wait_buyer_pay', out_trade_no, trade_no);
			} else if (trade_status == 'WAIT_SELLER_SEND_GOODS') {                
				self.emit('create_partner_trade_by_buyer_wait_seller_send_goods', out_trade_no, trade_no);
			} else if (trade_status == 'WAIT_BUYER_CONFIRM_GOODS') {                
				self.emit('create_partner_trade_by_buyer_wait_buyer_confirm_goods', out_trade_no, trade_no);
			} else if (trade_status == 'TRADE_FINISHED') {                
				self.emit('create_partner_trade_by_buyer_trade_finished', out_trade_no, trade_no);
			}
			res.send("success");
		} else {
			//验证失败
			self.emit("verify_fail", _GET, 'create_partner_trade_by_buyer_return');
			res.send("fail");
		}
	});	
};
//服务器异步通知[处理函数]
Alipay.prototype.create_partner_trade_by_buyer_notify = function (req, res) {
	var self = this;
	var _POST = req.body;
	//计算得出通知验证结果
	var alipayNotify = new AlipayNotify(this.alipay_config);
	//验证消息是否是支付宝发出的合法消息
	alipayNotify.verifyNotify(_POST, function (verify_result) {
		if (verify_result) {//验证成功
			//商户订单号
			var out_trade_no = _POST['out_trade_no'];
			//支付宝交易号
			var trade_no = _POST['trade_no'];
			//交易状态
			var trade_status = _POST['trade_status'];
			if (trade_status  == 'WAIT_BUYER_PAY') {                
				self.emit('create_partner_trade_by_buyer_wait_buyer_pay', out_trade_no, trade_no);
			} else if (trade_status == 'WAIT_SELLER_SEND_GOODS') {                
				self.emit('create_partner_trade_by_buyer_wait_seller_send_goods', out_trade_no, trade_no);
			} else if (trade_status == 'WAIT_BUYER_CONFIRM_GOODS') {                
				self.emit('create_partner_trade_by_buyer_wait_buyer_confirm_goods', out_trade_no, trade_no);
			} else if (trade_status == 'TRADE_FINISHED') {                
				self.emit('create_partner_trade_by_buyer_trade_finished', out_trade_no, trade_no);
			}
			res.send("success");
		} else {
			//验证失败
			self.emit("verify_fail", _POST, 'create_partner_trade_by_buyer_notify');
			res.send("fail");
		}
	});	
};

//----------------------------------------【支付宝标准双接口】
Alipay.prototype.trade_create_by_buyer = function (data, res) {
	//建立请求
	var alipaySubmit = new AlipaySubmit(this.alipay_config);
	
	//构造要请求的参数数组，无需改动
	var parameter = {
		service: 'trade_create_by_buyer',
		partner: this.alipay_config.partner,
		payment_type: '1',
		notify_url: url.resolve(this.alipay_config.host, this.alipay_config.trade_create_by_buyer_notify_url),
		return_url: url.resolve(this.alipay_config.host , this.alipay_config.trade_create_by_buyer_return_url),
		seller_email: this.alipay_config.seller_email, 
		
		out_trade_no: data.out_trade_no,
		subject: data.subject,
		price: data.price,
		quantity: data.quantity,
		logistics_fee: data.logistics_fee,
		logistics_type: data.logistics_type,
		logistics_payment: data.logistics_payment,
		body: data.body,
		show_url: data.show_url,
		receive_name: data.receive_name,
		receive_address: data.receive_address,
		receive_zip: data.receive_zip,
		receive_phone: data.receive_phone,
		receive_mobile: data.receive_mobile,
		
		_input_charset: this.alipay_config['input_charset'].toLowerCase().trim()
	};

	var html_text = alipaySubmit.buildRequestForm(parameter,"get", "确认");
	res.send(html_text);
};
//页面跳转同步通知[处理函数]
Alipay.prototype.trade_create_by_buyer_return = function (req, res) {
	var self = this;
	var _GET = req.query;
	//计算得出通知验证结果
	var alipayNotify = new AlipayNotify(this.alipay_config);
	//验证消息是否是支付宝发出的合法消息
	alipayNotify.verifyReturn(_GET, function (verify_result) {
		if (verify_result) {//验证成功
			//商户订单号
			var out_trade_no = _GET['out_trade_no'];
			//支付宝交易号
			var trade_no = _GET['trade_no'];
			//交易状态
			var trade_status = _GET['trade_status'];
			
			if (trade_status  == 'WAIT_BUYER_PAY') {                
				self.emit('trade_create_by_buyer_wait_buyer_pay', out_trade_no, trade_no);
			} else if (trade_status == 'WAIT_SELLER_SEND_GOODS') {                
				self.emit('trade_create_by_buyer_wait_seller_send_goods', out_trade_no, trade_no);
			} else if (trade_status == 'WAIT_BUYER_CONFIRM_GOODS') {                
				self.emit('trade_create_by_buyer_wait_buyer_confirm_goods', out_trade_no, trade_no);
			} else if (trade_status == 'TRADE_FINISHED') {                
				self.emit('trade_create_by_buyer_trade_finished', out_trade_no, trade_no);
			}
			res.send("success");
		} else {
			//验证失败
			self.emit("verify_fail", _GET, 'trade_create_by_buyer_return');
			res.send("fail");
		}
	});	
};
//服务器异步通知[处理函数]
Alipay.prototype.trade_create_by_buyer_notify = function (req, res) {
	var self = this;

	var _POST = req.body;
	//计算得出通知验证结果
	var alipayNotify = new AlipayNotify(this.alipay_config);
	//验证消息是否是支付宝发出的合法消息
	alipayNotify.verifyNotify(_POST, function (verify_result) {
		if (verify_result) {//验证成功
			//商户订单号
			var out_trade_no = _POST['out_trade_no'];
			//支付宝交易号
			var trade_no = _POST['trade_no'];
			//交易状态
			var trade_status = _POST['trade_status'];
			if (trade_status  == 'WAIT_BUYER_PAY') {                
				self.emit('trade_create_by_buyer_wait_buyer_pay', out_trade_no, trade_no);
			} else if (trade_status == 'WAIT_SELLER_SEND_GOODS') {                
				self.emit('trade_create_by_buyer_wait_seller_send_goods', out_trade_no, trade_no);
			} else if (trade_status == 'WAIT_BUYER_CONFIRM_GOODS') {                
				self.emit('trade_create_by_buyer_wait_buyer_confirm_goods', out_trade_no, trade_no);
			} else if (trade_status == 'TRADE_FINISHED') {                
				self.emit('trade_create_by_buyer_trade_finished', out_trade_no, trade_no);
			}
			res.send("success");
		} else {
			//验证失败
			self.emit("verify_fail", _POST, 'trade_create_by_buyer_notify');
			res.send("fail");
		}
	});	
};

//[未知]未被使用
// Alipay.prototype.send_goods_confirm_by_platform = function (data, res) {
// 	//建立请求
// 	var alipaySubmit = new AlipaySubmit(this.alipay_config);
// 	//构造要请求的参数数组，无需改动
// 	var parameter = {
// 		service : 'send_goods_confirm_by_platform',
// 		partner : this.alipay_config.partner,
		
// 		trade_no : data.trade_no,
// 		logistics_name : data.logistics_name,
// 		invoice_no : data.invoice_no,
// 		transport_type : data.transport_type,
		
// 		_input_charset	: this.alipay_config['input_charset'].toLowerCase().trim()
// 	};
// 	alipaySubmit.buildRequestHttp(parameter, function(html_text){
// 		//解析XML html_text
// 		var doc = new DOMParser().parseFromString(html_text);
// 		var is_success = doc.getElementsByTagName('is_success').item(0).firstChild.nodeValue
// 		if(is_success == 'T'){
// 			var out_trade_no = doc.getElementsByTagName('out_trade_no').item(0).firstChild.nodeValue;
// 			var trade_no = doc.getElementsByTagName('trade_no').item(0).firstChild.nodeValue;
// 			self.emit('send_goods_confirm_by_platform_success', out_trade_no, trade_no, html_text);
// 		}
// 		else if(is_success == 'F'){
// 			var error = doc.getElementsByTagName('error').item(0).firstChild.nodeValue;
// 			self.emit('send_goods_confirm_by_platform_fail', error);
// 		}
// 	});		
// };

exports.Alipay = Alipay;