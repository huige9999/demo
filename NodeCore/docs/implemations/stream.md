# 大日志文件过滤器

## 题目
假设有一个大日志文件 app.log，内容类似：

```
[INFO] 用户 vichel 登录成功
[ERROR] 数据库连接失败
[WARN] 接口响应过慢
[INFO] 用户提交订单
[ERROR] 支付回调异常
```

要求你写一个 Node 脚本：

```
node filter-log.js
```

实现功能：
读取app.log，把其中包含 [ERROR] 的行过滤出来，写入一个新的文件 error.log。

最终error.log的内容应该是：

```
[ERROR] 数据库连接失败
[ERROR] 支付回调异常
```