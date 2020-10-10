var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

if (!process.env) process.env = {};
if (!process.argv) process.argv = [];

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/potato.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var core, eventcaster, form, model, model_extras, utils, view, widget;

  core = require('./core');

  utils = require('./utils');

  eventcaster = require('./eventcaster');

  model = require('./model');

  view = require('./view');

  form = require('./form');

  widget = require('./widget');

  model_extras = require('./model-extras');

  module.exports = utils.extend({}, core, utils, eventcaster, model, view, form, widget, model_extras);

}).call(this);

});

require.define("/core.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var HardCoded, List, ListOf, Literal, Map, MapOf, Potato, Tuber, delegateTo, error, extend, interfaceToContent, notImplementedError, pick, rextend, utils,
    __slice = [].slice;

  utils = require('./utils');

  rextend = utils.rextend;

  pick = utils.pick;

  extend = utils.extend;

  interfaceToContent = function(interfas, sectionHandlers) {
    var extraContent, k, sectionHandler, v;
    extraContent = {};
    for (k in interfas) {
      v = interfas[k];
      sectionHandler = sectionHandlers[k];
      if (sectionHandler != null) {
        rextend(extraContent, sectionHandler(v));
      } else {
        extraContent[k] = v;
      }
    }
    return extraContent;
  };

  Tuber = function(content) {
    var extendMyself;
    extendMyself = function(extraInterface) {
      var extraContent, msg, newContent;
      extraContent = interfaceToContent(extraInterface, content.__sectionHandlers__);
      if (this.constructor.THIS_IS_NOT_A_CONSTRUCTOR_DUMMY != null) {
        msg = "Do no call 'new YourPotato()'. Instanciation is done via Yourmake()'.";
        throw msg;
      }
      newContent = rextend({}, content, extraContent);
      return Tuber(newContent);
    };
    extendMyself.THIS_IS_NOT_A_CONSTRUCTOR_DUMMY = true;
    rextend(extendMyself, content);
    return extendMyself;
  };

  delegateTo = function(delegateMember, methodName) {
    return function() {
      var member;
      member = delegateMember.apply(this);
      return member[methodName].apply(member, arguments);
    };
  };

  Potato = Tuber({
    __sectionHandlers__: {
      "static": function(staticDic) {
        return staticDic;
      },
      properties: function(propertyDic) {
        return {
          __potaproperties__: propertyDic
        };
      },
      methods: function(methodDic) {
        var k, res, v, _fn;
        res = {
          __potaproto__: methodDic
        };
        _fn = function(k, v) {
          if (!(res[k] != null)) {
            return res[k] = function() {
              var args, self;
              self = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
              return self[k].apply(self, args);
            };
          }
        };
        for (k in methodDic) {
          v = methodDic[k];
          _fn(k, v);
        }
        return res;
      },
      components: function(componentDic) {
        return {
          __potacompo__: componentDic
        };
      },
      delegates: function(delegateDic) {
        var delegated_methods, k, v, _fn;
        delegated_methods = {};
        _fn = function(k, v) {
          return delegated_methods[k] = function() {
            var args, _ref;
            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            return (_ref = this[v])[k].apply(_ref, args);
          };
        };
        for (k in delegateDic) {
          v = delegateDic[k];
          _fn(k, v);
        }
        return {
          __potaproto__: delegated_methods
        };
      }
    }
  });

  Potato = Potato({
    methods: {
      components: function() {
        return this.__potato__.components(this);
      },
      set: function(data) {
        var component, componentId, components;
        if (data.__potato__ != null) {
          return data;
        } else {
          components = this.components();
          for (componentId in components) {
            component = components[componentId];
            if (data[componentId] != null) {
              this[componentId] = component.set(this[componentId], data[componentId]);
            }
          }
          return this;
        }
      },
      setData: function(data) {
        var component, componentId, components;
        components = this.components();
        for (componentId in components) {
          component = components[componentId];
          if (data[componentId] != null) {
            this[componentId] = component.setData(this[componentId], data[componentId]);
          }
        }
        return this;
      },
      copy: function(obj) {
        return this.__potato__.make(obj);
      }
    },
    "static": {
      type: 'potato',
      __init__: function(obj) {},
      make: function(data) {
        var actualConstructor, newInstance, potato;
        if (data == null) {
          data = void 0;
        }
        potato = this;
        actualConstructor = function() {
          var k, v, _ref, _ref1;
          _ref = potato.__potacompo__;
          for (k in _ref) {
            v = _ref[k];
            this[k] = v.make();
          }
          _ref1 = potato.__potaproperties__;
          for (k in _ref1) {
            v = _ref1[k];
            this[k] = v.make();
          }
          return this;
        };
        actualConstructor.prototype.__potato__ = potato;
        extend(actualConstructor.prototype, potato.__potaproto__);
        newInstance = new actualConstructor;
        this.__init__(newInstance);
        if (data != null) {
          newInstance.set(data);
        }
        return newInstance;
      },
      makeFromData: function(data) {
        var obj;
        obj = this.make();
        obj.setData(data);
        return obj;
      },
      components: function() {
        return this.__potacompo__;
      }
    }
  });

  error = function() {
    var arg, args, _i, _len, _results;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    _results = [];
    for (_i = 0, _len = args.length; _i < _len; _i++) {
      arg = args[_i];
      _results.push(console.log("ERROR : ", arg));
    }
    return _results;
  };

  Literal = Tuber({
    __sectionHandlers__: {},
    type: 'json',
    make: function(val) {
      if (val != null) {
        return val;
      } else {
        return pick(this["default"]);
      }
    },
    fromData: function(val) {
      return val;
    },
    toJSON: function(val) {
      return JSON.stringify(this.toData(val));
    },
    toData: function(val) {
      return val;
    },
    set: function(obj, val) {
      return val;
    },
    setData: function(obj, val) {
      return this.set(obj, val);
    },
    makeFromData: function(data) {
      return data;
    }
  });

  List = Literal({
    type: 'list',
    itemType: Literal({
      "default": Literal
    }),
    toData: function(obj) {
      var it, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = obj.length; _i < _len; _i++) {
        it = obj[_i];
        _results.push(this.itemType.toData(it));
      }
      return _results;
    },
    add: function(obj, item) {
      return obj.push(item);
    },
    addData: function(obj, data) {
      var item;
      item = this.itemType.make(data);
      return this.add(obj, item);
    },
    make: function(data) {
      var k, _i, _ref;
      if (data == null) {
        data = [];
      }
      for (k = _i = 0, _ref = data.length; 0 <= _ref ? _i < _ref : _i > _ref; k = 0 <= _ref ? ++_i : --_i) {
        data[k] = this.itemType.make(data[k]);
      }
      return data;
    },
    set: function(l, data) {
      return data;
    },
    setData: function(obj, val) {
      var it, _i, _len;
      obj.length = 0;
      for (_i = 0, _len = val.length; _i < _len; _i++) {
        it = val[_i];
        this.add(obj, this.itemType.make(it));
      }
      return obj;
    },
    makeFromData: function(data) {
      var obj;
      obj = this.make();
      obj.setData(data);
      return obj;
    }
  });

  Map = Literal({
    type: 'map',
    itemType: Literal,
    make: function(data) {
      var newInstance;
      newInstance = {};
      if (data != null) {
        newInstance.set(data);
      }
      return newInstance;
    },
    toData: function(obj) {
      var data, k, v;
      data = {};
      for (k in obj) {
        v = obj[k];
        data[k] = this.__potato__.itemType.toData(v);
      }
      return data;
    },
    set: function(obj, data) {
      return data;
    },
    setData: function(obj, val) {
      var k, v, _results;
      for (k in obj) {
        v = obj[k];
        delete obj[k];
      }
      _results = [];
      for (k in val) {
        v = val[k];
        _results.push(obj[k] = this.itemType.makeFromData(val));
      }
      return _results;
    },
    makeFromData: function(data) {
      var obj;
      obj = this.make();
      obj.setData(data);
      return obj;
    }
  });

  ListOf = function(itemType) {
    return List({
      itemType: itemType
    });
  };

  MapOf = function(itemType) {
    return Map({
      itemType: itemType
    });
  };

  notImplementedError = function() {
    throw "Not Implemented Error";
  };

  HardCoded = function(value) {
    return {
      make: function() {
        return pick(value);
      }
    };
  };

  module.exports = {
    ListOf: ListOf,
    MapOf: MapOf,
    notImplementedError: notImplementedError,
    Literal: Literal,
    HardCoded: HardCoded,
    Potato: Potato,
    Tuber: Tuber
  };

}).call(this);

});

require.define("/utils.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var SIMPLE_DICTIONARY_CONSTRUCTOR, SPLIT_ONCE_PER_TYPE, extend, genericSplitOnce, log, mapDict, pick, regexSplitOnce, removeEl, rextend, split, stringSplitOnce, twoRecursiveExtend,
    __slice = [].slice;

  extend = function() {
    var dest, extra, extras, k, v, _i, _len;
    dest = arguments[0], extras = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    for (_i = 0, _len = extras.length; _i < _len; _i++) {
      extra = extras[_i];
      for (k in extra) {
        v = extra[k];
        dest[k] = v;
      }
    }
    return dest;
  };

  stringSplitOnce = function(splitter) {
    return function(s) {
      var pos;
      pos = s.indexOf(splitter);
      if (pos >= 0) {
        return [s.slice(0, pos), s.slice(pos + splitter.length)];
      } else {
        return void 0;
      }
    };
  };

  regexSplitOnce = function(splitter) {
    return function(s) {
      var match, matchLength, pos;
      match = splitter.exec(s);
      if (match != null) {
        matchLength = match[0].length;
        pos = match.index;
        return [s.slice(0, pos), s.slice(pos + matchLength)];
      } else {
        return void 0;
      }
    };
  };

  SPLIT_ONCE_PER_TYPE = {
    "string": stringSplitOnce,
    "object": regexSplitOnce
  };

  genericSplitOnce = function(splitter) {
    var typeSpecificSplitOnce;
    typeSpecificSplitOnce = SPLIT_ONCE_PER_TYPE[typeof splitter];
    return typeSpecificSplitOnce(splitter);
  };

  split = function(s, splitter, n) {
    var chunks, h, splitOnce, splitResult, t;
    if (n == null) {
      n = -1;
    }
    splitOnce = genericSplitOnce(splitter);
    chunks = [];
    while (n !== 1) {
      splitResult = splitOnce(s);
      if (splitResult != null) {
        h = splitResult[0], t = splitResult[1];
        s = t;
        chunks.push(h);
        n -= 1;
      } else {
        break;
      }
    }
    chunks.push(s);
    return chunks;
  };

  removeEl = function(arr, el, n) {
    var elId, nbOcc;
    if (n == null) {
      n = 1;
    }
    nbOcc = n;
    while (nbOcc !== 0) {
      elId = arr.indexOf(el);
      if (elId !== -1) {
        arr.splice(elId, 1);
        nbOcc -= 1;
      } else {
        return n - nbOcc;
      }
    }
    return n;
  };

  SIMPLE_DICTIONARY_CONSTRUCTOR = {}.constructor;

  twoRecursiveExtend = function(dest, extra) {
    var k, v;
    for (k in extra) {
      v = extra[k];
      if ((typeof v) === "object" && (v != null) && !(v.length != null) && v.constructor === SIMPLE_DICTIONARY_CONSTRUCTOR) {
        if (!(dest[k] != null)) {
          dest[k] = {};
        }
        rextend(dest[k], v);
      } else {
        dest[k] = v;
      }
    }
    return dest;
  };

  rextend = function() {
    var obj, objs, res, _i, _len, _ref;
    objs = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    res = objs[0];
    _ref = objs.slice(1);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      obj = _ref[_i];
      twoRecursiveExtend(res, obj);
    }
    return res;
  };

  pick = function(v) {
    if (typeof v === "function") {
      return v();
    } else {
      return v;
    }
  };

  mapDict = function(f, c) {
    var k, res, v;
    res = {};
    for (k in c) {
      v = c[k];
      res[k] = f(v);
    }
    return res;
  };

  log = function(msg) {
    return typeof console !== "undefined" && console !== null ? console.log(msg) : void 0;
  };

  module.exports = {
    extend: extend,
    mapDict: mapDict,
    pick: pick,
    split: split,
    rextend: rextend,
    removeEl: removeEl,
    log: log
  };

}).call(this);

});

require.define("/eventcaster.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var EventCaster, core, utils,
    __slice = [].slice;

  utils = require('./utils');

  core = require('./core');

  EventCaster = core.Potato({
    properties: {
      __listeners: core.Literal({
        "default": function() {
          return {};
        }
      })
    },
    "static": {
      __init__: function(obj) {
        return obj.trigger("init");
      }
    },
    methods: {
      trigger: function() {
        var args, callback, evtName, listeners, _i, _len, _results;
        evtName = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
        listeners = this.__listeners[evtName];
        if (listeners != null) {
          listeners = listeners.slice(0);
          _results = [];
          for (_i = 0, _len = listeners.length; _i < _len; _i++) {
            callback = listeners[_i];
            _results.push(callback.apply(null, args));
          }
          return _results;
        }
      },
      bind: function(evtName, callback) {
        var _ref;
        this.__listeners[evtName] = (_ref = this.__listeners[evtName]) != null ? _ref : [];
        return this.__listeners[evtName].push(callback);
      },
      unbind: function(evtName, callback) {
        var callbacks;
        callbacks = this.__listeners[evtName];
        if (callbacks != null) {
          utils.removeEl(callbacks, callback, -1);
          if (callbacks.length === 0) {
            delete this.__listeners[evtName];
          }
        }
        return this;
      }
    }
  });

  module.exports = {
    EventCaster: EventCaster
  };

}).call(this);

});

require.define("/model.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var Boolean, CollectionOf, Enum, Integer, Model, String, core, eventcaster, model, utils,
    __slice = [].slice;

  core = require('./core');

  eventcaster = require('./eventcaster');

  utils = require('./utils');

  Integer = core.Literal({
    type: 'integer',
    MIN: 0,
    MAX: 10,
    STEP: 1,
    "default": 0,
    validate: function(data) {
      if ((typeof data) === "number" && (data === Math.round(data))) {
        return {
          ok: true
        };
      } else {
        return {
          ok: false,
          errors: "" + data + " is not an integer"
        };
      }
    }
  });

  String = core.Literal({
    type: 'string',
    "default": "",
    validate: function(data) {
      if ((typeof data) === "string") {
        return {
          ok: true
        };
      } else {
        return {
          ok: false,
          errors: "Expected a string."
        };
      }
    }
  });

  Boolean = core.Literal({
    type: 'boolean',
    "default": false,
    validate: function(data) {
      if ((typeof data) === "boolean") {
        return {
          ok: true
        };
      } else {
        return {
          ok: false,
          errors: "Boolean expected."
        };
      }
    }
  });

  Enum = String({
    type: 'radio',
    "default": "yes",
    choices: [
      {
        id: "yes",
        name: "yes"
      }, {
        id: "no",
        name: "no"
      }
    ],
    validate: function(value) {
      var choice, _i, _len, _ref;
      _ref = this.choices;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        choice = _ref[_i];
        if (choice.id === value) {
          return {
            ok: true
          };
        }
      }
      return {
        ok: false,
        errors: "Enum value <" + value + "> not in " + this.choices + "."
      };
    }
  });

  Model = eventcaster.EventCaster({
    methods: {
      validate: function() {
        var args, _ref;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        return (_ref = this.__potato__).validate.apply(_ref, args);
      },
      destroy: function() {
        return this.trigger("destroy");
      },
      toJSON: function() {
        return JSON.stringify(this.toData());
      },
      toData: function() {
        var data, k, v, _ref;
        data = {};
        _ref = this.components();
        for (k in _ref) {
          v = _ref[k];
          data[k] = v.toData(this[k]);
        }
        return data;
      },
      copy: function(obj) {
        return this.__potato__.make(obj);
      },
      set: function(data) {
        var component, componentId, components;
        if (data.__potato__ != null) {
          data;

        } else {
          components = this.components();
          for (componentId in components) {
            component = components[componentId];
            if (data[componentId] != null) {
              this[componentId] = component.set(this[componentId], data[componentId]);
            }
          }
        }
        this.trigger("change");
        return this;
      },
      find: function(elDsl) {
        var head, sep, target;
        elDsl = elDsl.trim();
        if (elDsl === "") {
          return this;
        }
        if (elDsl[0] === "@") {
          sep = POTATO_SELECTOR_DSL_SEP.exec(elDsl).index;
          head = elDsl.slice(1, sep);
          elDsl = elDsl.slice(sep + 1);
          target = this[head];
          return target.find(elDsl.slice(1));
        } else {
          console.log("Selection DSL for model should start with an @");
          return null;
        }
      },
      url: function() {}
    },
    "static": {
      validate: function(data) {
        var cid, component, componentValidation, validationResult, _ref;
        validationResult = {
          ok: true
        };
        _ref = this.components();
        for (cid in _ref) {
          component = _ref[cid];
          componentValidation = component.validate(data[cid]);
          if (!componentValidation.ok) {
            validationResult.ok = false;
            if (!(validationResult.errors != null)) {
              validationResult.errors = {};
            }
            validationResult.errors[cid] = componentValidation.errors;
          }
        }
        return validationResult;
      },
      fromJSON: function(json) {
        var data;
        data = JSON.parse(json);
        return this.fromData(data);
      },
      fromData: function(data) {
        var obj;
        obj = this.make();
        return this.setData(obj, data);
      }
    }
  });

  CollectionOf = function(itemType) {
    return Model({
      components: {
        __items: core.ListOf(itemType)
      },
      methods: {
        add: function(item) {
          var _this = this;
          this.items().push(item);
          this.trigger("add", item);
          this.trigger("change");
          if (item.bind != null) {
            item.bind("change", function() {
              return _this.trigger("change");
            });
            item.bind("destroy", function() {
              return _this.remove(item);
            });
          }
          return this;
        },
        remove: function(item) {
          var nbRemovedEl;
          nbRemovedEl = utils.removeEl(this.__items, item, 1);
          if (nbRemovedEl > 0) {
            return this.trigger("change");
          }
        },
        filter: function(predicate) {
          var el, els, _i, _len, _ref;
          els = [];
          _ref = this.items();
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            el = _ref[_i];
            if (predicate(el)) {
              els.push(el);
            }
          }
          return els;
        },
        items: function() {
          return this.__items;
        },
        item: function(itemId, value) {
          var selectedItem;
          selectedItem = this.__items[itemId];
          if (!(value != null)) {
            return selectedItem;
          } else {
            return this.__items[itemId] = this.components().__items.itemType.set(selectedItem, value);
          }
        },
        setData: function(data) {
          var itemData, _i, _len;
          this.__items = [];
          for (_i = 0, _len = data.length; _i < _len; _i++) {
            itemData = data[_i];
            this.addData(itemData);
          }
          this.trigger("change");
          return this;
        },
        toData: function() {
          return this.components().__items.toData(this.__items);
        },
        addData: function(itemData) {
          return this.add(itemType.fromData(itemData));
        },
        size: function() {
          return this.__items.length;
        }
      },
      "static": {
        validate: function(data) {
          var item, itemId, itemValidation, validationResult;
          validationResult = {
            ok: true
          };
          for (itemId in data) {
            item = data[itemId];
            itemValidation = this.itemType.validate(item);
            if (!(itemValidation.ok != null)) {
              if (!(validationResult.errors != null)) {
                validationResult.errors = {};
              }
              validationResult.errors[itemId] = itemValidation.errors;
            }
          }
          return validationResult;
        }
      }
    });
  };

  model = {
    Model: Model,
    CollectionOf: CollectionOf,
    Integer: Integer,
    String: String,
    Boolean: Boolean,
    Enum: Enum
  };

  module.exports = model;

}).call(this);

});

require.define("/view.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var $, CollectionViewOf, HTMLElement, POTATO_SELECTOR_DSL_SEP, TEMPLATE_PLACEHOLDER_PTN, View, core, eventcaster, hogan, model, utils,
    __slice = [].slice;

  core = require('./core');

  model = require('./model');

  eventcaster = require('./eventcaster');

  utils = require('./utils');

  hogan = require('hogan.js');

  TEMPLATE_PLACEHOLDER_PTN = /<#\s*([\w_]+)\s*\/?>/;

  if (!(typeof window !== "undefined" && window !== null)) {
    $ = (function(x) {
      return x;
    });
  } else {
    $ = window.$;
  }

  HTMLElement = core.Literal({
    tagName: '<div>',
    make: function(elval) {
      return $(elval != null ? elval : this.tagName);
    },
    set: function(self, obj) {
      return obj;
    }
  });

  POTATO_SELECTOR_DSL_SEP = /$|\ /;

  View = eventcaster.EventCaster({
    __sectionHandlers__: {
      template: function(tmpl) {
        var cid, index, index2, newEl, placeholderMatch, tmpTmpl, whole;
        while (placeholderMatch = TEMPLATE_PLACEHOLDER_PTN.exec(tmpl)) {
          whole = placeholderMatch[0], cid = placeholderMatch[1];
          index = placeholderMatch.index;
          index2 = index + whole.length;
          newEl = "<div id='__ELEMENT_" + cid + "'></div>";
          tmpTmpl = tmpl.slice(0, index) + newEl + tmpl.slice(index2);
          tmpl = tmpTmpl;
        }
        return {
          __template__: function() {
            var args, _ref;
            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            return (_ref = hogan.compile(tmpl)).render.apply(_ref, args);
          }
        };
      },
      events: function(v) {
        return {
          __events__: v
        };
      },
      model: function(v) {
        return {
          __potaproperties__: {
            model: v
          }
        };
      },
      el: function(v) {
        return {
          __potaproperties__: {
            el: HTMLElement({
              tagName: v
            })
          }
        };
      }
    }
  });

  View = View({
    template: '',
    model: model.Model,
    el: "<div>",
    properties: {
      __bound__: core.ListOf(core.Potato)
    },
    methods: {
      context: function(parent) {
        if (parent != null) {
          return parent;
        } else {
          return this;
        }
      },
      destroy: function() {
        this.unbindEvents();
        this.el.remove();
        return this.trigger("destroy");
      },
      setModel: function(model) {
        var cid, component, _ref;
        this.model = model;
        _ref = this.components();
        for (cid in _ref) {
          component = _ref[cid];
          if (component.__isView__ != null) {
            if (model[cid] != null) {
              this[cid].setModel(model[cid]);
            }
          }
        }
        return this;
      },
      autoRefresh: function() {
        var _this = this;
        return this.model.bind("change", function() {
          return _this.render();
        });
      },
      renderTemplate: function(context) {
        var component, componentContainer, componentId, _ref, _results;
        this.el.html(this.__potato__.__template__(context));
        _ref = this.components();
        _results = [];
        for (componentId in _ref) {
          component = _ref[componentId];
          if (component.__isView__ != null) {
            componentContainer = this.el.find("#__ELEMENT_" + componentId);
            if (componentContainer.size() === 1) {
              this[componentId].render(context);
              _results.push(componentContainer.replaceWith(this[componentId].el));
            } else {
              _results.push(void 0);
            }
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      },
      find: function(elDsl) {
        var head, sep;
        elDsl = elDsl.trim();
        if (elDsl === "") {
          return this;
        } else if (elDsl[0] === "@") {
          sep = POTATO_SELECTOR_DSL_SEP.exec(elDsl).index;
          head = elDsl.slice(1, sep);
          elDsl = elDsl.slice(sep + 1);
          window.el = this[head];
          if (elDsl.trim() === "") {
            return this[head];
          } else {
            return this[head].find(elDsl);
          }
        } else {
          return this.el.find(elDsl);
        }
      },
      unbindEvents: function() {
        var el, evt, handler, _i, _len, _ref, _ref1;
        _ref = this.__bound__;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          _ref1 = _ref[_i], el = _ref1[0], evt = _ref1[1], handler = _ref1[2];
          el.unbind(evt, handler);
        }
        return this;
      },
      bindEvents: function() {
        var bindEvents, callback, el, elDsl, evt, me, _fn, _ref;
        this.unbindEvents();
        me = this;
        _ref = this.__potato__.__events__;
        for (elDsl in _ref) {
          bindEvents = _ref[elDsl];
          el = this.find(elDsl);
          _fn = function(callback) {
            var handler;
            handler = function() {
              var args;
              args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
              return callback.call.apply(callback, [me].concat(__slice.call(args)));
            };
            el.bind(evt, handler);
            return me.__bound__.push([el, evt, handler]);
          };
          for (evt in bindEvents) {
            callback = bindEvents[evt];
            _fn(callback);
          }
        }
        return this;
      },
      render: function(parent) {
        var context;
        context = this.context(parent);
        this.renderTemplate(context);
        this.bindEvents();
        return this.trigger("render", context);
      }
    },
    "static": {
      keyHandlers: {
        el: function(content, tagValue) {
          return content.components.el = HTMLElement({
            tagName: tagValue
          });
        }
      },
      loadInto: function($container) {
        var instance;
        instance = this.make();
        instance.el = $($container);
        instance.render();
        return instance;
      },
      __isView__: true
    }
  });

  CollectionViewOf = function(itemType) {
    return View({
      el: '<ul>',
      components: {
        __items: core.ListOf(itemType)
      },
      methods: {
        addData: function(data) {
          var newItem;
          newItem = this.__addViewItem(data);
          newItem.render();
          this.el.append(newItem.el);
          return this;
        },
        remove: function(item) {
          var nbRemovedEl;
          return nbRemovedEl = utils.removeEl(this.__items, item, 1);
        },
        setModel: function(itemModelList) {
          this.model = itemModelList;
          return this.__buildItemsFromModel();
        },
        __addViewItem: function(model) {
          var newItem,
            _this = this;
          newItem = itemType.make();
          newItem.setModel(model);
          this.__items.push(newItem);
          newItem.bind("destroy", function() {
            return _this.remove(newItem);
          });
          return newItem;
        },
        destroyAllItems: function() {
          var item, _i, _len, _ref;
          _ref = this.__items;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            item = _ref[_i];
            if (item.destroy != null) {
              item.destroy();
            }
          }
          return this.__items = [];
        },
        __buildItemsFromModel: function() {
          var item, _i, _len, _ref;
          this.destroyAllItems();
          _ref = this.model;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            item = _ref[_i];
            this.__addViewItem(item);
          }
          return this;
        },
        __renderItems: function() {
          var it, _i, _len, _ref, _results;
          this.el.empty();
          _ref = this.__items;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            it = _ref[_i];
            it.render();
            _results.push(this.el.append(it.el));
          }
          return _results;
        },
        render: function() {
          this.__renderItems();
          return this.trigger("render");
        }
      }
    });
  };

  module.exports = {
    View: View,
    HTMLElement: HTMLElement,
    CollectionViewOf: CollectionViewOf
  };

}).call(this);

});

require.define("/node_modules/hogan.js/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {"main":"./lib/hogan.js"}
});

require.define("/node_modules/hogan.js/lib/hogan.js", function (require, module, exports, __dirname, __filename) {
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This file is for use with Node.js. See dist/ for browser files.

var Hogan = require('./compiler');
Hogan.Template = require('./template').Template;
module.exports = Hogan; 
});

require.define("/node_modules/hogan.js/lib/compiler.js", function (require, module, exports, __dirname, __filename) {
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

(function (Hogan) {
  // Setup regex  assignments
  // remove whitespace according to Mustache spec
  var rIsWhitespace = /\S/,
      rQuot = /\"/g,
      rNewline =  /\n/g,
      rCr = /\r/g,
      rSlash = /\\/g,
      tagTypes = {
        '#': 1, '^': 2, '/': 3,  '!': 4, '>': 5,
        '<': 6, '=': 7, '_v': 8, '{': 9, '&': 10
      };

  Hogan.scan = function scan(text, delimiters) {
    var len = text.length,
        IN_TEXT = 0,
        IN_TAG_TYPE = 1,
        IN_TAG = 2,
        state = IN_TEXT,
        tagType = null,
        tag = null,
        buf = '',
        tokens = [],
        seenTag = false,
        i = 0,
        lineStart = 0,
        otag = '{{',
        ctag = '}}';

    function addBuf() {
      if (buf.length > 0) {
        tokens.push(new String(buf));
        buf = '';
      }
    }

    function lineIsWhitespace() {
      var isAllWhitespace = true;
      for (var j = lineStart; j < tokens.length; j++) {
        isAllWhitespace =
          (tokens[j].tag && tagTypes[tokens[j].tag] < tagTypes['_v']) ||
          (!tokens[j].tag && tokens[j].match(rIsWhitespace) === null);
        if (!isAllWhitespace) {
          return false;
        }
      }

      return isAllWhitespace;
    }

    function filterLine(haveSeenTag, noNewLine) {
      addBuf();

      if (haveSeenTag && lineIsWhitespace()) {
        for (var j = lineStart, next; j < tokens.length; j++) {
          if (!tokens[j].tag) {
            if ((next = tokens[j+1]) && next.tag == '>') {
              // set indent to token value
              next.indent = tokens[j].toString()
            }
            tokens.splice(j, 1);
          }
        }
      } else if (!noNewLine) {
        tokens.push({tag:'\n'});
      }

      seenTag = false;
      lineStart = tokens.length;
    }

    function changeDelimiters(text, index) {
      var close = '=' + ctag,
          closeIndex = text.indexOf(close, index),
          delimiters = trim(
            text.substring(text.indexOf('=', index) + 1, closeIndex)
          ).split(' ');

      otag = delimiters[0];
      ctag = delimiters[1];

      return closeIndex + close.length - 1;
    }

    if (delimiters) {
      delimiters = delimiters.split(' ');
      otag = delimiters[0];
      ctag = delimiters[1];
    }

    for (i = 0; i < len; i++) {
      if (state == IN_TEXT) {
        if (tagChange(otag, text, i)) {
          --i;
          addBuf();
          state = IN_TAG_TYPE;
        } else {
          if (text.charAt(i) == '\n') {
            filterLine(seenTag);
          } else {
            buf += text.charAt(i);
          }
        }
      } else if (state == IN_TAG_TYPE) {
        i += otag.length - 1;
        tag = tagTypes[text.charAt(i + 1)];
        tagType = tag ? text.charAt(i + 1) : '_v';
        if (tagType == '=') {
          i = changeDelimiters(text, i);
          state = IN_TEXT;
        } else {
          if (tag) {
            i++;
          }
          state = IN_TAG;
        }
        seenTag = i;
      } else {
        if (tagChange(ctag, text, i)) {
          tokens.push({tag: tagType, n: trim(buf), otag: otag, ctag: ctag,
                       i: (tagType == '/') ? seenTag - ctag.length : i + otag.length});
          buf = '';
          i += ctag.length - 1;
          state = IN_TEXT;
          if (tagType == '{') {
            if (ctag == '}}') {
              i++;
            } else {
              cleanTripleStache(tokens[tokens.length - 1]);
            }
          }
        } else {
          buf += text.charAt(i);
        }
      }
    }

    filterLine(seenTag, true);

    return tokens;
  }

  function cleanTripleStache(token) {
    if (token.n.substr(token.n.length - 1) === '}') {
      token.n = token.n.substring(0, token.n.length - 1);
    }
  }

  function trim(s) {
    if (s.trim) {
      return s.trim();
    }

    return s.replace(/^\s*|\s*$/g, '');
  }

  function tagChange(tag, text, index) {
    if (text.charAt(index) != tag.charAt(0)) {
      return false;
    }

    for (var i = 1, l = tag.length; i < l; i++) {
      if (text.charAt(index + i) != tag.charAt(i)) {
        return false;
      }
    }

    return true;
  }

  function buildTree(tokens, kind, stack, customTags) {
    var instructions = [],
        opener = null,
        token = null;

    while (tokens.length > 0) {
      token = tokens.shift();
      if (token.tag == '#' || token.tag == '^' || isOpener(token, customTags)) {
        stack.push(token);
        token.nodes = buildTree(tokens, token.tag, stack, customTags);
        instructions.push(token);
      } else if (token.tag == '/') {
        if (stack.length === 0) {
          throw new Error('Closing tag without opener: /' + token.n);
        }
        opener = stack.pop();
        if (token.n != opener.n && !isCloser(token.n, opener.n, customTags)) {
          throw new Error('Nesting error: ' + opener.n + ' vs. ' + token.n);
        }
        opener.end = token.i;
        return instructions;
      } else {
        instructions.push(token);
      }
    }

    if (stack.length > 0) {
      throw new Error('missing closing tag: ' + stack.pop().n);
    }

    return instructions;
  }

  function isOpener(token, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].o == token.n) {
        token.tag = '#';
        return true;
      }
    }
  }

  function isCloser(close, open, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].c == close && tags[i].o == open) {
        return true;
      }
    }
  }

  Hogan.generate = function (tree, text, options) {
    var code = 'var _=this;_.b(i=i||"");' + walk(tree) + 'return _.fl();';
    if (options.asString) {
      return 'function(c,p,i){' + code + ';}';
    }

    return new Hogan.Template(new Function('c', 'p', 'i', code), text, Hogan, options);
  }

  function esc(s) {
    return s.replace(rSlash, '\\\\')
            .replace(rQuot, '\\\"')
            .replace(rNewline, '\\n')
            .replace(rCr, '\\r');
  }

  function chooseMethod(s) {
    return (~s.indexOf('.')) ? 'd' : 'f';
  }

  function walk(tree) {
    var code = '';
    for (var i = 0, l = tree.length; i < l; i++) {
      var tag = tree[i].tag;
      if (tag == '#') {
        code += section(tree[i].nodes, tree[i].n, chooseMethod(tree[i].n),
                        tree[i].i, tree[i].end, tree[i].otag + " " + tree[i].ctag);
      } else if (tag == '^') {
        code += invertedSection(tree[i].nodes, tree[i].n,
                                chooseMethod(tree[i].n));
      } else if (tag == '<' || tag == '>') {
        code += partial(tree[i]);
      } else if (tag == '{' || tag == '&') {
        code += tripleStache(tree[i].n, chooseMethod(tree[i].n));
      } else if (tag == '\n') {
        code += text('"\\n"' + (tree.length-1 == i ? '' : ' + i'));
      } else if (tag == '_v') {
        code += variable(tree[i].n, chooseMethod(tree[i].n));
      } else if (tag === undefined) {
        code += text('"' + esc(tree[i]) + '"');
      }
    }
    return code;
  }

  function section(nodes, id, method, start, end, tags) {
    return 'if(_.s(_.' + method + '("' + esc(id) + '",c,p,1),' +
           'c,p,0,' + start + ',' + end + ',"' + tags + '")){' +
           '_.rs(c,p,' +
           'function(c,p,_){' +
           walk(nodes) +
           '});c.pop();}';
  }

  function invertedSection(nodes, id, method) {
    return 'if(!_.s(_.' + method + '("' + esc(id) + '",c,p,1),c,p,1,0,0,"")){' +
           walk(nodes) +
           '};';
  }

  function partial(tok) {
    return '_.b(_.rp("' +  esc(tok.n) + '",c,p,"' + (tok.indent || '') + '"));';
  }

  function tripleStache(id, method) {
    return '_.b(_.t(_.' + method + '("' + esc(id) + '",c,p,0)));';
  }

  function variable(id, method) {
    return '_.b(_.v(_.' + method + '("' + esc(id) + '",c,p,0)));';
  }

  function text(id) {
    return '_.b(' + id + ');';
  }

  Hogan.parse = function(tokens, text, options) {
    options = options || {};
    return buildTree(tokens, '', [], options.sectionTags || []);
  },

  Hogan.cache = {};

  Hogan.compile = function(text, options) {
    // options
    //
    // asString: false (default)
    //
    // sectionTags: [{o: '_foo', c: 'foo'}]
    // An array of object with o and c fields that indicate names for custom
    // section tags. The example above allows parsing of {{_foo}}{{/foo}}.
    //
    // delimiters: A string that overrides the default delimiters.
    // Example: "<% %>"
    //
    options = options || {};

    var key = text + '||' + !!options.asString;

    var t = this.cache[key];

    if (t) {
      return t;
    }

    t = this.generate(this.parse(this.scan(text, options.delimiters), text, options), text, options);
    return this.cache[key] = t;
  };
})(typeof exports !== 'undefined' ? exports : Hogan);

});

require.define("/node_modules/hogan.js/lib/template.js", function (require, module, exports, __dirname, __filename) {
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var Hogan = {};

(function (Hogan, useArrayBuffer) {
  Hogan.Template = function (renderFunc, text, compiler, options) {
    this.r = renderFunc || this.r;
    this.c = compiler;
    this.options = options;
    this.text = text || '';
    this.buf = (useArrayBuffer) ? [] : '';
  }

  Hogan.Template.prototype = {
    // render: replaced by generated code.
    r: function (context, partials, indent) { return ''; },

    // variable escaping
    v: hoganEscape,

    // triple stache
    t: coerceToString,

    render: function render(context, partials, indent) {
      return this.ri([context], partials || {}, indent);
    },

    // render internal -- a hook for overrides that catches partials too
    ri: function (context, partials, indent) {
      return this.r(context, partials, indent);
    },

    // tries to find a partial in the curent scope and render it
    rp: function(name, context, partials, indent) {
      var partial = partials[name];

      if (!partial) {
        return '';
      }

      if (this.c && typeof partial == 'string') {
        partial = this.c.compile(partial, this.options);
      }

      return partial.ri(context, partials, indent);
    },

    // render a section
    rs: function(context, partials, section) {
      var tail = context[context.length - 1];

      if (!isArray(tail)) {
        section(context, partials, this);
        return;
      }

      for (var i = 0; i < tail.length; i++) {
        context.push(tail[i]);
        section(context, partials, this);
        context.pop();
      }
    },

    // maybe start a section
    s: function(val, ctx, partials, inverted, start, end, tags) {
      var pass;

      if (isArray(val) && val.length === 0) {
        return false;
      }

      if (typeof val == 'function') {
        val = this.ls(val, ctx, partials, inverted, start, end, tags);
      }

      pass = (val === '') || !!val;

      if (!inverted && pass && ctx) {
        ctx.push((typeof val == 'object') ? val : ctx[ctx.length - 1]);
      }

      return pass;
    },

    // find values with dotted names
    d: function(key, ctx, partials, returnFound) {
      var names = key.split('.'),
          val = this.f(names[0], ctx, partials, returnFound),
          cx = null;

      if (key === '.' && isArray(ctx[ctx.length - 2])) {
        return ctx[ctx.length - 1];
      }

      for (var i = 1; i < names.length; i++) {
        if (val && typeof val == 'object' && names[i] in val) {
          cx = val;
          val = val[names[i]];
        } else {
          val = '';
        }
      }

      if (returnFound && !val) {
        return false;
      }

      if (!returnFound && typeof val == 'function') {
        ctx.push(cx);
        val = this.lv(val, ctx, partials);
        ctx.pop();
      }

      return val;
    },

    // find values with normal names
    f: function(key, ctx, partials, returnFound) {
      var val = false,
          v = null,
          found = false;

      for (var i = ctx.length - 1; i >= 0; i--) {
        v = ctx[i];
        if (v && typeof v == 'object' && key in v) {
          val = v[key];
          found = true;
          break;
        }
      }

      if (!found) {
        return (returnFound) ? false : "";
      }

      if (!returnFound && typeof val == 'function') {
        val = this.lv(val, ctx, partials);
      }

      return val;
    },

    // higher order templates
    ho: function(val, cx, partials, text, tags) {
      var compiler = this.c;
      var options = this.options;
      options.delimiters = tags;
      var text = val.call(cx, text);
      text = (text == null) ? String(text) : text.toString();
      this.b(compiler.compile(text, options).render(cx, partials));
      return false;
    },

    // template result buffering
    b: (useArrayBuffer) ? function(s) { this.buf.push(s); } :
                          function(s) { this.buf += s; },
    fl: (useArrayBuffer) ? function() { var r = this.buf.join(''); this.buf = []; return r; } :
                           function() { var r = this.buf; this.buf = ''; return r; },

    // lambda replace section
    ls: function(val, ctx, partials, inverted, start, end, tags) {
      var cx = ctx[ctx.length - 1],
          t = null;

      if (!inverted && this.c && val.length > 0) {
        return this.ho(val, cx, partials, this.text.substring(start, end), tags);
      }

      t = val.call(cx);

      if (typeof t == 'function') {
        if (inverted) {
          return true;
        } else if (this.c) {
          return this.ho(t, cx, partials, this.text.substring(start, end), tags);
        }
      }

      return t;
    },

    // lambda replace variable
    lv: function(val, ctx, partials) {
      var cx = ctx[ctx.length - 1];
      var result = val.call(cx);

      if (typeof result == 'function') {
        result = coerceToString(result.call(cx));
        if (this.c && ~result.indexOf("{\u007B")) {
          return this.c.compile(result, this.options).render(cx, partials);
        }
      }

      return coerceToString(result);
    }

  };

  var rAmp = /&/g,
      rLt = /</g,
      rGt = />/g,
      rApos =/\'/g,
      rQuot = /\"/g,
      hChars =/[&<>\"\']/;


  function coerceToString(val) {
    return String((val === null || val === undefined) ? '' : val);
  }

  function hoganEscape(str) {
    str = coerceToString(str);
    return hChars.test(str) ?
      str
        .replace(rAmp,'&amp;')
        .replace(rLt,'&lt;')
        .replace(rGt,'&gt;')
        .replace(rApos,'&#39;')
        .replace(rQuot, '&quot;') :
      str;
  }

  var isArray = Array.isArray || function(a) {
    return Object.prototype.toString.call(a) === '[object Array]';
  };

})(typeof exports !== 'undefined' ? exports : Hogan);


});

require.define("/form.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var Checkbox, Field, Form, FormFactory, Input, IntegerForm, JSONForm, PotatoForm, PotatoFormOf, RadioBoxesOf, TextField, core, model, optionid, utils, view, widget,
    __slice = [].slice;

  utils = require('./utils');

  core = require('./core');

  model = require('./model');

  view = require('./view');

  widget = require('./widget');

  Form = view.View({
    methods: {
      edit: function(model) {
        return this.set_val(model);
      },
      val: function(value) {
        if (!(value != null)) {
          return this.get_val();
        } else {
          return this.set_val(value);
        }
      },
      get_val: function() {
        throw "NotImplemented";
      },
      set_val: function(data) {
        throw "NotImplemented";
      },
      is_modified: function() {
        throw "NotImplemented";
      },
      validate: function() {
        throw "NotImplemented";
      },
      print_errors: function(errors) {
        throw "NotImplemented";
      },
      render: function(parent) {
        var context;
        context = this.context(parent);
        this.renderTemplate(context);
        this.bindEvents();
        if (context !== void 0) {
          this.set_val(context);
        }
        return this.trigger("render", context);
      },
      context: function(parent) {
        return void 0;
      }
    }
  });

  PotatoForm = Form({
    el: "<fieldset>",
    methods: {
      get_val: function() {
        var k, res, v, _ref;
        res = {};
        _ref = this.components();
        for (k in _ref) {
          v = _ref[k];
          res[k] = this[k].get_val();
        }
        return res;
      },
      set_val: function(val) {
        var changed, k, v, _, _ref;
        changed = false;
        _ref = this.components();
        for (k in _ref) {
          _ = _ref[k];
          v = val[k];
          if (v != null) {
            if (this[k].set_val(v)) {
              changed = true;
            }
          }
        }
        if (changed) {
          return this.trigger("change");
        }
      },
      validate: function() {
        "Validate the form and print out eventual\nerrors in the form.\nReturns\n  - undefined if the value is not valid.\n  - the value of the model else.";

        var validation, value;
        value = this.val();
        validation = this.__potato__.model.validate(value);
        if (validation.ok) {
          this.print_valid();
          return value;
        } else {
          this.print_errors(validation.errors);
          return void 0;
        }
      },
      print_errors: function(errors) {
        var k, v, _ref, _results;
        _ref = this.components();
        _results = [];
        for (k in _ref) {
          v = _ref[k];
          if (errors[k] != null) {
            _results.push(this[k].print_errors(errors[k]));
          } else {
            _results.push(this[k].print_valid());
          }
        }
        return _results;
      },
      print_valid: function() {
        var k, v, _ref, _results;
        _ref = this.components();
        _results = [];
        for (k in _ref) {
          v = _ref[k];
          _results.push(this[k].print_valid());
        }
        return _results;
      }
    }
  });

  PotatoFormOf = function(model) {
    var content, k, label, template, v, _ref, _ref1;
    content = {};
    content.components = utils.mapDict((function(model) {
      return FormFactory.FormOf(model);
    }), model.components());
    utils.rextend(content, {
      "static": {
        model: model
      }
    });
    template = "";
    if (model.label) {
      template += "<legend>" + model.label + "</legend>";
    }
    _ref = model.components();
    for (k in _ref) {
      v = _ref[k];
      if (v.type !== 'potato') {
        label = (_ref1 = v.label) != null ? _ref1 : k;
        template += "<label>" + label + "</label>\n<#" + k + "/>\n<div style='clear: both;'/>";
      } else {
        template += "<#" + k + "/>";
      }
    }
    content.template = template;
    return PotatoForm(content);
  };

  Input = view.View({
    el: "<input type=text>",
    methods: {
      get_val: function() {
        return this.el.val();
      },
      set_val: function(val) {
        if (val !== this.get_val()) {
          this.el.val(val);
          this.trigger("change");
          return true;
        } else {
          return false;
        }
      },
      val: function(value) {
        if (!(value != null)) {
          return this.get_val();
        } else {
          return this.set_val(value);
        }
      }
    }
  });

  Field = Form({
    template: "<#input/><#error/>",
    components: {
      input: Input,
      error: view.View({
        el: "<div class='error_msg'>",
        template: "{{errors}}"
      })
    },
    delegates: {
      get_val: "input",
      set_val: "input"
    },
    methods: {
      print_errors: function(errors) {
        return this.error.render({
          errors: errors
        });
      },
      print_valid: function() {
        return this.error.render({
          errors: ""
        });
      }
    },
    events: {
      "@input": {
        "change": function() {
          var args;
          args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
          return this.trigger.apply(this, ["change"].concat(__slice.call(args)));
        }
      }
    }
  });

  TextField = Field;

  Checkbox = Field({
    components: {
      input: Input({
        el: "<input type='checkbox'>",
        methods: {
          get_val: function() {
            return this.el.attr("checked") === "checked";
          },
          set_val: function(val) {
            if (val !== this.get_val()) {
              window.checkbox = this;
              this.el.attr("checked", val);
              this.trigger("change");
              return true;
            } else {
              return false;
            }
          }
        },
        events: {
          "@el": {
            "change": function() {
              var args;
              args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
              return this.trigger("change");
            }
          }
        }
      })
    }
  });

  IntegerForm = Field({
    components: {
      input: Input({
        el: "<input type='number' step='1' required='' placeholder=''>",
        methods: {
          onRender: function() {
            var integerModel, _ref, _ref1;
            integerModel = this.components().model;
            this.el.attr("min", integerModel.MIN);
            this.el.attr("max", integerModel.MAX);
            this.el.attr("step", integerModel.STEP);
            return this.el.attr("placeholder", (_ref = (_ref1 = integerModel.help) != null ? _ref1 : integerModel.label) != null ? _ref : "");
          },
          get_val: function() {
            return parseInt(this.el.val(), 10);
          },
          set_val: function(val) {
            if (val !== this.get_val()) {
              this.el.val("" + val);
              return true;
            } else {
              return false;
            }
          }
        }
      })
    }
  });

  JSONForm = Field({
    components: {
      input: Input({
        template: "{}",
        el: "<textarea>",
        methods: {
          get_val: function() {
            return JSON.parse(this.el.val());
          },
          set_val: function(val) {
            if (JSON.stringify(val !== this.el.val())) {
              this.el.val(JSON.stringify(val));
              this.trigger("change");
              return true;
            } else {
              return false;
            }
          }
        }
      })
    }
  });

  optionid = 0;

  RadioBoxesOf = function(EnumModel) {
    return Field({
      "static": {
        model: EnumModel
      },
      components: {
        input: Input({
          methods: {
            context: function() {
              optionid += 1;
              return {
                choices: EnumModel.choices,
                choiceid: "options#" + optionid
              };
            },
            selectedInput: function() {
              var $radiobtn, radiobtn, _i, _len, _ref;
              _ref = this.el.find("input");
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                radiobtn = _ref[_i];
                $radiobtn = $(radiobtn);
                if ($radiobtn.is(':checked')) {
                  return $radiobtn;
                }
              }
              return null;
            },
            get_val: function() {
              var selectedInput;
              selectedInput = this.selectedInput();
              return selectedInput != null ? selectedInput.attr("value") : void 0;
            },
            set_val: function(val) {
              var $radiobtn, checked, radiobtn, _i, _len, _ref;
              if (val !== this.get_val()) {
                _ref = this.el.find("input");
                for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                  radiobtn = _ref[_i];
                  $radiobtn = $(radiobtn);
                  checked = $radiobtn.attr("value") === val;
                  $radiobtn.prop("checked", checked);
                }
                return true;
              } else {
                return false;
              }
            }
          },
          template: "{{#choices}}\n    <input type = \"radio\"\n       id = \"{{ id }}\"\n       name = \"{{ choiceid }}\"\n       value = \"{{ id }}\"/>\n    <label for=\"{{ id }}\">{{ name }}</label><br/>\n    {{/choices}}",
          el: "<div class='input-list'>",
          properties: {
            choiceid: model.Integer
          }
        })
      },
      events: {
        "@input @el input": {
          "change": function() {
            return this.trigger("change");
          }
        }
      }
    });
  };

  FormFactory = core.Tuber({
    __sectionHandlers__: {},
    widgets: {
      list: function(model) {
        return JSONForm({
          "static": {
            model: model
          }
        });
      },
      json: function(model) {
        return JSONForm({
          "static": {
            model: model
          }
        });
      },
      string: function(model) {
        return TextField({
          "static": {
            model: model
          }
        });
      },
      integer: function(model) {
        return IntegerForm({
          "static": {
            model: model
          }
        });
      },
      radio: RadioBoxesOf,
      "boolean": function(model) {
        return Checkbox({
          "static": {
            model: model
          }
        });
      },
      potato: PotatoFormOf
    },
    FormOf: function(model) {
      return this.widgets[model.type](model);
    }
  });

  module.exports = {
    FormFactory: FormFactory,
    Form: Form,
    JSONForm: JSONForm
  };

}).call(this);

});

require.define("/widget.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var MenuItem, TabMenu, core, model, view;

  core = require('./core');

  model = require('./model');

  view = require('./view');

  MenuItem = model.Model({
    components: {
      id: model.String,
      label: model.String
    }
  });

  TabMenu = view.View({
    help: "This menu represents a tabmenu. That is a menu\nwith always exactly one item selected at a time.\n\nIf a selected value is supplied by the user,\nthe event is triggered once on startup.\n\nIf a user clicks more than once on a menu item,\nthe event is only triggered the first time.",
    el: "<ul class='menu'>",
    model: core.ListOf(MenuItem),
    template: "{{#model}}<li data-item_id='{{id}}'>{{label}}</li>{{/model}}",
    methods: {
      addItem: function(id, label) {
        this.model.push(MenuItem.make({
          id: id,
          label: label
        }));
        return this.render();
      },
      findItem: function(item_id) {
        return this.find("li[data-item_id='" + item_id + "']");
      },
      select: function(item_id) {
        if (this.selected !== item_id) {
          this.findItem(this.selected).removeClass("selected");
          this.findItem(item_id).addClass("selected");
          this.selected = item_id;
          return this.trigger("select", item_id);
        }
      },
      onRender: function() {
        var selected;
        if (this.findItem(this.selected).length !== 1) {
          if (this.model.length > 0) {
            this.selected = this.model[0].item;
          }
        }
        selected = this.selected;
        this.selected = void 0;
        return this.select(selected);
      }
    },
    events: {
      "li": {
        "click": function(evt) {
          var item_id;
          item_id = evt.currentTarget.dataset.item_id;
          return this.select(item_id);
        }
      }
    }
  });

  module.exports = {
    TabMenu: TabMenu
  };

}).call(this);

});

require.define("/model-extras.js", function (require, module, exports, __dirname, __filename) {
// Generated by CoffeeScript 1.4.0
(function() {
  var Email, NonEmptyString, model;

  model = require('./model');

  NonEmptyString = model.String({
    "default": "something...",
    validate: function(data) {
      var validAsString;
      validAsString = model.String.validate(data);
      if (validAsString.ok && data !== "") {
        return {
          ok: true
        };
      } else {
        return {
          ok: false,
          errors: "Must not be empty."
        };
      }
    }
  });

  Email = model.String({
    EMAIL_PTN: /^([\w.-]+)@([\w.-]+)\.([a-zA-Z.]{2,6})$/i,
    validate: function(val) {
      if (this.EMAIL_PTN.exec(val) != null) {
        return {
          ok: true
        };
      } else {
        return {
          ok: false,
          errors: 'This is not a valid email address.'
        };
      }
    }
  });

  module.exports = {
    Email: Email,
    NonEmptyString: NonEmptyString
  };

}).call(this);

});

require.define("/entry-point-browserify.js", function (require, module, exports, __dirname, __filename) {
    // Generated by CoffeeScript 1.4.0
(function() {

  window.potato = require("./potato.js");

}).call(this);

});
require("/entry-point-browserify.js");
