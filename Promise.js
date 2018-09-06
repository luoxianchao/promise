//1、promise 必须具有 then方法且then方法可以被一个promise对象调用多次，并且三种状态 pending fulfilled rejected
var asyncFun = (function () {
    if (typeof process === 'object' && process !== null && typeof (process.nextTick) === 'function') {
        return process.nextTick;
    } else if (typeof (setImmediate) === 'function') {
        return setImmediate;
    }
    return setTimeout;
})();

function Promise(fn) {
    var self = this;
    //表示执行状态
    this._state = 'pending';
    //then方法注册回调函数数组
    this._deffereds = [];
    //当前promise执行成功之后的值
    this.value = null;
    try {
        //执行构造函数的参数，参数是一个包括fulfilled，rejected两个形参的匿名函数
        fn(function (value) {//相当于new Promise对象传递的success函数
            resolve(self, value);//promise对象要求操作成功之后要进行当前的状态改变，进入到fulfilled状态，并且把注册的数组函数全部依次执行
        }, function (reason) {
            reject(self, reason);//promise对象操作失败异常情况下要调用reject函数进行异常的处理，并且把promise状态改为rejected
        });
    } catch (e) {
        //错误执行
        reject(self, e);
    }
}

//用来处理链式调用then注册的方法
function Handler(onResolved, onRejected, promise) {
    this.resolve = typeof onResolved === 'function' ? onResolved : null;
    this.reject = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
}

//函数功能为根据当前 promise 状态，异步执行 onResolved 或 onRejected 回调函数。
function handleResolved(promise, handler) {
    asyncFun(function () {
        var cb = promise._state === 'fulfilled' ? handler.resolve : handler.reject;
        if (cb === null) {//表示then函数没有任何回调
            if (promise._state === 'fulfilled') {
                resolve(handler.promise, promise.value);
            } else {
                reject(handler.promise, promise.value);
            }
            return;
        }
        //执行注册回调
        try {
            //实际执行的是then函数的回调
            var res = cb(promise.value);
        } catch (e) {
            reject(handler.promise, e);
        }
        resolve(handler.promise, res);
    });
}

//resolve===》fulfilled
function resolve(promise, val) {
    //判断当前promise是否是pending状态
    if (promise._state !== 'pending') {
        return;
    }
    //判断当前value是否是当前promise对象，如果是则不能执行
    if (promise === val) {
        return reject(promise, new TypeError('a promise cannot be resolve itself'));
    }

    //如果执行结果value是promise对象，则使promise接受value的状态
    // 对应 Promise A+ 规范 2.3.2
    if (val && val instanceof Promise && promise.then === val.then) {
        var deferedes = promise._deffereds;
        if (val._state === 'pending') {
            // value 为 pending 状态  表示执行前一个promise执行成功之后回调里新初始化一个promise对象
            // 对应 Promise A+ 规范 2.3.2.1 将promise的回调注册转移给value
            deferedes.forEach(function (t) {
                val._deffereds.push(t)
            });
        } else if (deferedes.length != 0) { // value 为非 pending 状态，并且当前promise注册的回调函数不为0，则用value的then函数处理这些注册回调
            //这里本质上是用val这个执行结果promise对象代替当前的promise对象去处理
            //使用 value 作为当前 promise，执行 then 注册回调处理
            // 对应 Promise A+ 规范 2.3.2.2、2.3.2.3
            deferedes.forEach(function (t) {
                handleResolved(val, t);
            });
            //清空value的deffereds
            val._deffereds = [];
        }
        return;
    }
    //判断当前promise返回对象是否是thenable对象或者函数
    //对应 Promise A+ 规范 2.3.3
    if (val && (typeof val === 'object' || typeof val === 'function')) {
        var then = val.then;
        if (typeof then === 'function') {
            //如果是thenable对象，则执行then函数回调resolve方法
            then.call(val, function (value) {
                resolve(promise, value);
            }, function (reason) {
                reject(promise, reason);
            });
            return;
        }
    }
    // 改变 promise 内部状态为 `resolved`
    promise.value = val;
    //一调用resolve方法就改变promise的执行状态
    promise._state = 'fulfilled';

    //如果promise存在then注册函数，则依次执行
    if (promise._deffereds.length !== 0) {
        promise._deffereds.forEach(function (t) {
            handleResolved(promise, t);
        });
        //清空 then 注册回调处理数组
        promise._deffereds = [];
    }
}

//pending === > rejected
function reject(promise, err) {
    if (promise._state === 'pending') {
        return;
    }
    promise._state = 'rejected';
    promise.value = err;
    //如果promise存在then注册函数，则依次执行
    if (promise._deffereds.length !== 0) {
        promise._deffereds.forEach(function (t) {
            handleResolved(promise, t);
        });
        //清空 then 注册回调处理数组
        promise._deffereds = [];
    }
};

Promise.prototype.then = function (onResolved, onRejected) {
    //实例化一个空的promise用来保持链式调用
    var promise = new Promise(function () {
    });
    //使用onResolved onRejected实例化handle对象
    var handler = new Handler(onResolved, onRejected, promise);

    //判断当前promise的状态
    if (this._state === 'pending') {
        this._deffereds.push(handler);
    } else {
        //如果当前promise不是pending状态，则执行resolved或者rejected状态
        handleResolved(this, handler);
    }
    //返回新的promise对象
    return promise;
};

Promise.prototype.catch = function (onRejected) {
    return this.then(null, onRejected);
};