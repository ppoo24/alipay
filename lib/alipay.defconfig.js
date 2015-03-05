/* *
 * 配置文件
 * 版本：3.3
 * 日期：2012-07-19
 * 说明：
 * 以下代码只是为了方便商户测试而提供的样例代码，商户可以根据自己网站的需要，按照技术文档编写,并非一定要使用该代码。
 * 该代码仅供学习和研究支付宝接口使用，只是提供一个参考。
	
 * 提示：如何获取安全校验码和合作身份者id
 * 1.用您的签约支付宝账号登录支付宝网站(www.alipay.com)
 * 2.点击“商家服务”(https://b.alipay.com/order/myorder.htm)
 * 3.点击“查询合作者身份(pid)”、“查询安全校验码(key)”
	
 * 安全校验码查看时，输入支付密码后，页面呈灰色的现象，怎么办？
 * 解决方法：
 * 1、检查浏览器配置，不让浏览器做弹框屏蔽设置
 * 2、更换浏览器或电脑，重新登录查询。
 */

var path = require('path');

module.exports = {
	//------------【基本】
	//合作身份者id，以2088开头的16位纯数字
	'partner': '',
	//安全检验码，以数字和字母组成的32位字符
	'key': '',
	//签名方式 不需修改（大写）
	'sign_type': 'MD5',
	//字符编码格式 目前支持 gbk 或 utf-8（小写）
	'input_charset': 'utf-8',
	//ca证书路径地址，用于curl中ssl校验
	//请保证cacert.pem文件在当前文件夹目录中
	'cacert': path.join(__dirname, './cacert.pem'),
	//访问模式,根据自己的服务器是否支持ssl访问，若支持请选择https；若不支持请选择http
	'transport': 'http',

	//------------【额外必须】
	'seller_email': '', //卖家支付宝帐户 必填
	'host': 'http://localhost:3000/', //本服务器根地址

	//------------【内部路由映射】
	//---[即时到帐交易接口---相关路径]
	'create_direct_pay_by_user_notify_url': '/alipay/create_direct_pay_by_user/notify_url', //服务器异步通知页面路径(将与host参数结合为完整路径，不能加?id=123这类自定义参数)
	'create_direct_pay_by_user_return_url': '/alipay/create_direct_pay_by_user/return_url', //页面跳转同步通知页面路径(将与host参数结合为完整路径，不能加?id=123这类自定义参数)
	//---[即时到账批量退款有密接口---相关路径]
	'refund_fastpay_by_platform_pwd_notify_url': '/alipay/refund_fastpay_by_platform_pwd/notify_url', //服务器异步通知页面路径
	//---[纯担保交易接口接口---相关路径]
	'create_partner_trade_by_buyer_notify_url': '/aplipay/create_partner_trade_by_buyer/notify_url', //服务器异步通知页面路径
	'create_partner_trade_by_buyer_return_url': '/aplipay/create_partner_trade_by_buyer/return_url', //页面跳转同步通知页面路径
	//---[支付宝标准双接口---相关路径]
	'trade_create_by_buyer_notify_url': '/alipay/trade_create_by_buyer/notify_url', //服务器异步通知页面路径
	'trade_create_by_buyer_return_url' : '/alipay/trade_create_by_buyer/return_url' //页面跳转同步通知页面路径
};