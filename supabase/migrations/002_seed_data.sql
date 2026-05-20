-- 维度数据 (DWD)
INSERT INTO dimensions (name, code, description) VALUES
('时间', 'time', '天级时间维度，格式 yyyy-MM-dd'),
('省份', 'province', '中国省级行政区'),
('城市', 'city', '城市级别'),
('渠道', 'channel', '流量来源渠道：APP、小程序、H5、PC'),
('设备类型', 'device_type', '用户设备：iOS、Android、Web'),
('商品类目', 'category', '商品一级类目：服装、数码、食品等'),
('商品SPU', 'spu', '商品标准产品单元'),
('支付方式', 'pay_type', '支付方式：支付宝、微信、银行卡'),
('订单状态', 'order_status', '订单生命周期状态'),
('会员等级', 'vip_level', '用户会员等级：普通、银卡、金卡、钻石');

-- 事实表定义 (DWD)
INSERT INTO fact_tables (name, code, description, dims, measures) VALUES
('交易订单事实表', 'dwd_trade_order', '交易核心订单数据，包含下单、支付、退款全链路',
 ARRAY['time', 'province', 'city', 'channel', 'device_type', 'category', 'spu', 'pay_type', 'order_status', 'vip_level'],
 ARRAY['order_id', 'user_id', 'sku_id', 'quantity', 'original_amount', 'discount_amount', 'pay_amount', 'cost_amount']),

('支付成功事实表', 'dwd_pay_success', '支付成功的订单明细，用于GMV和收入计算',
 ARRAY['time', 'province', 'channel', 'pay_type', 'vip_level'],
 ARRAY['order_id', 'user_id', 'pay_amount', 'pay_time', 'pay_seq_no']),

('退款事实表', 'dwd_refund', '退款申请和完成记录，用于退款率计算',
 ARRAY['time', 'province', 'category', 'refund_reason'],
 ARRAY['order_id', 'refund_id', 'user_id', 'refund_amount', 'apply_time', 'complete_time']),

('用户注册事实表', 'dwd_user_register', '新用户注册记录，用于新客数计算',
 ARRAY['time', 'province', 'channel', 'device_type'],
 ARRAY['user_id', 'register_time', 'first_order_time']),

('购物车事实表', 'dwd_cart', '购物车加购行为，用于转化率漏斗',
 ARRAY['time', 'user_id', 'spu', 'category'],
 ARRAY['cart_id', 'sku_id', 'quantity', 'cart_amount', 'is_convert']);

-- 原子指标
INSERT INTO metrics (name, type, source, measure, agg, dims) VALUES
('GMV', 'atomic', 'dwd_trade_order', 'original_amount', 'SUM', ARRAY['time', 'province', 'city', 'channel', 'category']),
('实付金额', 'atomic', 'dwd_pay_success', 'pay_amount', 'SUM', ARRAY['time', 'province', 'channel', 'pay_type', 'vip_level']),
('订单数', 'atomic', 'dwd_trade_order', 'order_id', 'COUNT_DISTINCT', ARRAY['time', 'province', 'channel', 'category', 'vip_level']),
('支付订单数', 'atomic', 'dwd_pay_success', 'order_id', 'COUNT_DISTINCT', ARRAY['time', 'province', 'channel', 'pay_type']),
('退款金额', 'atomic', 'dwd_refund', 'refund_amount', 'SUM', ARRAY['time', 'province', 'category']),
('退款订单数', 'atomic', 'dwd_refund', 'order_id', 'COUNT_DISTINCT', ARRAY['time', 'province', 'category']),
('新注册用户数', 'atomic', 'dwd_user_register', 'user_id', 'COUNT_DISTINCT', ARRAY['time', 'province', 'channel', 'device_type']),
('加购次数', 'atomic', 'dwd_cart', 'cart_id', 'COUNT', ARRAY['time', 'category', 'spu']),
('加购人数', 'atomic', 'dwd_cart', 'user_id', 'COUNT_DISTINCT', ARRAY['time', 'category']),
('商品销售数量', 'atomic', 'dwd_trade_order', 'quantity', 'SUM', ARRAY['time', 'category', 'spu']);

-- 衍生指标
INSERT INTO metrics (name, type, source, condition, dims) VALUES
('APP渠道GMV', 'derived', 'GMV', 'channel = ''APP''', ARRAY['time', 'province', 'category']),
('微信小程序订单数', 'derived', '订单数', 'channel = ''WECHAT_MINI''', ARRAY['time', 'province']),
('新客首单GMV', 'derived', 'GMV', 'is_first_order = true', ARRAY['time', 'channel']),
('钻石会员实付金额', 'derived', '实付金额', 'vip_level = ''DIAMOND''', ARRAY['time', 'province']),
('iOS设备订单数', 'derived', '订单数', 'device_type = ''IOS''', ARRAY['time', 'channel']),
('服装类目退款金额', 'derived', '退款金额', 'category = ''CLOTHING''', ARRAY['time', 'province']),
('支付宝支付GMV', 'derived', '实付金额', 'pay_type = ''ALIPAY''', ARRAY['time', 'province']);

-- 复合指标
INSERT INTO metrics (name, type, formula, base_metrics, dims) VALUES
('客单价', 'composite', '[实付金额] / [支付订单数]', ARRAY['实付金额', '支付订单数'], ARRAY['time', 'channel', 'vip_level']),
('退款率', 'composite', '[退款金额] / [GMV] * 100', ARRAY['退款金额', 'GMV'], ARRAY['time', 'province', 'category']),
('支付转化率', 'composite', '[支付订单数] / [订单数] * 100', ARRAY['支付订单数', '订单数'], ARRAY['time', 'channel', 'device_type']),
('加购转化率', 'composite', '[支付订单数] / [加购人数] * 100', ARRAY['支付订单数', '加购人数'], ARRAY['time', 'category']),
('平均退款金额', 'composite', '[退款金额] / [退款订单数]', ARRAY['退款金额', '退款订单数'], ARRAY['time', 'category']),
('毛利额', 'composite', '[实付金额] - [成本金额]', ARRAY['实付金额', '成本金额'], ARRAY['time', 'category']),
('毛利率', 'composite', '([实付金额] - [成本金额]) / [实付金额] * 100', ARRAY['实付金额', '成本金额'], ARRAY['time', 'category']);
