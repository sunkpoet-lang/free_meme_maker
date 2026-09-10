/*!
 * gifuct-js — decodificador de GIF puro en JavaScript (a fotogramas).
 * Empaquetado localmente (con esbuild) a partir del código fuente para
 * usarlo como script clásico, compatible con abrir esta app vía file://.
 * Autor original: Matt Way — https://github.com/matt-way/gifuct-js
 * Licencia: MIT
 */
var gifuct = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/js-binary-schema-parser/lib/index.js
  var require_lib = __commonJS({
    "node_modules/js-binary-schema-parser/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.loop = exports.conditional = exports.parse = void 0;
      var parse2 = function parse3(stream, schema) {
        var result = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        var parent = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : result;
        if (Array.isArray(schema)) {
          schema.forEach(function(partSchema) {
            return parse3(stream, partSchema, result, parent);
          });
        } else if (typeof schema === "function") {
          schema(stream, result, parent, parse3);
        } else {
          var key = Object.keys(schema)[0];
          if (Array.isArray(schema[key])) {
            parent[key] = {};
            parse3(stream, schema[key], result, parent[key]);
          } else {
            parent[key] = schema[key](stream, result, parent, parse3);
          }
        }
        return result;
      };
      exports.parse = parse2;
      var conditional = function conditional2(schema, conditionFunc) {
        return function(stream, result, parent, parse3) {
          if (conditionFunc(stream, result, parent)) {
            parse3(stream, schema, result, parent);
          }
        };
      };
      exports.conditional = conditional;
      var loop = function loop2(schema, continueFunc) {
        return function(stream, result, parent, parse3) {
          var arr = [];
          var lastStreamPos = stream.pos;
          while (continueFunc(stream, result, parent)) {
            var newParent = {};
            parse3(stream, schema, result, newParent);
            if (stream.pos === lastStreamPos) {
              break;
            }
            lastStreamPos = stream.pos;
            arr.push(newParent);
          }
          return arr;
        };
      };
      exports.loop = loop;
    }
  });

  // node_modules/js-binary-schema-parser/lib/parsers/uint8.js
  var require_uint8 = __commonJS({
    "node_modules/js-binary-schema-parser/lib/parsers/uint8.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.readBits = exports.readArray = exports.readUnsigned = exports.readString = exports.peekBytes = exports.readBytes = exports.peekByte = exports.readByte = exports.buildStream = void 0;
      var buildStream2 = function buildStream3(uint8Data) {
        return {
          data: uint8Data,
          pos: 0
        };
      };
      exports.buildStream = buildStream2;
      var readByte = function readByte2() {
        return function(stream) {
          return stream.data[stream.pos++];
        };
      };
      exports.readByte = readByte;
      var peekByte = function peekByte2() {
        var offset = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
        return function(stream) {
          return stream.data[stream.pos + offset];
        };
      };
      exports.peekByte = peekByte;
      var readBytes = function readBytes2(length) {
        return function(stream) {
          return stream.data.subarray(stream.pos, stream.pos += length);
        };
      };
      exports.readBytes = readBytes;
      var peekBytes = function peekBytes2(length) {
        return function(stream) {
          return stream.data.subarray(stream.pos, stream.pos + length);
        };
      };
      exports.peekBytes = peekBytes;
      var readString = function readString2(length) {
        return function(stream) {
          return Array.from(readBytes(length)(stream)).map(function(value) {
            return String.fromCharCode(value);
          }).join("");
        };
      };
      exports.readString = readString;
      var readUnsigned = function readUnsigned2(littleEndian) {
        return function(stream) {
          var bytes = readBytes(2)(stream);
          return littleEndian ? (bytes[1] << 8) + bytes[0] : (bytes[0] << 8) + bytes[1];
        };
      };
      exports.readUnsigned = readUnsigned;
      var readArray = function readArray2(byteSize, totalOrFunc) {
        return function(stream, result, parent) {
          var total = typeof totalOrFunc === "function" ? totalOrFunc(stream, result, parent) : totalOrFunc;
          var parser = readBytes(byteSize);
          var arr = new Array(total);
          for (var i = 0; i < total; i++) {
            arr[i] = parser(stream);
          }
          return arr;
        };
      };
      exports.readArray = readArray;
      var subBitsTotal = function subBitsTotal2(bits, startIndex, length) {
        var result = 0;
        for (var i = 0; i < length; i++) {
          result += bits[startIndex + i] && Math.pow(2, length - i - 1);
        }
        return result;
      };
      var readBits = function readBits2(schema) {
        return function(stream) {
          var _byte = readByte()(stream);
          var bits = new Array(8);
          for (var i = 0; i < 8; i++) {
            bits[7 - i] = !!(_byte & 1 << i);
          }
          return Object.keys(schema).reduce(function(res, key) {
            var def = schema[key];
            if (def.length) {
              res[key] = subBitsTotal(bits, def.index, def.length);
            } else {
              res[key] = bits[def.index];
            }
            return res;
          }, {});
        };
      };
      exports.readBits = readBits;
    }
  });

  // node_modules/js-binary-schema-parser/lib/schemas/gif.js
  var require_gif = __commonJS({
    "node_modules/js-binary-schema-parser/lib/schemas/gif.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = void 0;
      var _ = require_lib();
      var _uint = require_uint8();
      var subBlocksSchema = {
        blocks: function blocks(stream) {
          var terminator = 0;
          var chunks = [];
          var streamSize = stream.data.length;
          var total = 0;
          for (var size = (0, _uint.readByte)()(stream); size !== terminator; size = (0, _uint.readByte)()(stream)) {
            if (!size) break;
            if (stream.pos + size >= streamSize) {
              var availableSize = streamSize - stream.pos;
              chunks.push((0, _uint.readBytes)(availableSize)(stream));
              total += availableSize;
              break;
            }
            chunks.push((0, _uint.readBytes)(size)(stream));
            total += size;
          }
          var result = new Uint8Array(total);
          var offset = 0;
          for (var i = 0; i < chunks.length; i++) {
            result.set(chunks[i], offset);
            offset += chunks[i].length;
          }
          return result;
        }
      };
      var gceSchema = (0, _.conditional)({
        gce: [{
          codes: (0, _uint.readBytes)(2)
        }, {
          byteSize: (0, _uint.readByte)()
        }, {
          extras: (0, _uint.readBits)({
            future: {
              index: 0,
              length: 3
            },
            disposal: {
              index: 3,
              length: 3
            },
            userInput: {
              index: 6
            },
            transparentColorGiven: {
              index: 7
            }
          })
        }, {
          delay: (0, _uint.readUnsigned)(true)
        }, {
          transparentColorIndex: (0, _uint.readByte)()
        }, {
          terminator: (0, _uint.readByte)()
        }]
      }, function(stream) {
        var codes = (0, _uint.peekBytes)(2)(stream);
        return codes[0] === 33 && codes[1] === 249;
      });
      var imageSchema = (0, _.conditional)({
        image: [{
          code: (0, _uint.readByte)()
        }, {
          descriptor: [{
            left: (0, _uint.readUnsigned)(true)
          }, {
            top: (0, _uint.readUnsigned)(true)
          }, {
            width: (0, _uint.readUnsigned)(true)
          }, {
            height: (0, _uint.readUnsigned)(true)
          }, {
            lct: (0, _uint.readBits)({
              exists: {
                index: 0
              },
              interlaced: {
                index: 1
              },
              sort: {
                index: 2
              },
              future: {
                index: 3,
                length: 2
              },
              size: {
                index: 5,
                length: 3
              }
            })
          }]
        }, (0, _.conditional)({
          lct: (0, _uint.readArray)(3, function(stream, result, parent) {
            return Math.pow(2, parent.descriptor.lct.size + 1);
          })
        }, function(stream, result, parent) {
          return parent.descriptor.lct.exists;
        }), {
          data: [{
            minCodeSize: (0, _uint.readByte)()
          }, subBlocksSchema]
        }]
      }, function(stream) {
        return (0, _uint.peekByte)()(stream) === 44;
      });
      var textSchema = (0, _.conditional)({
        text: [{
          codes: (0, _uint.readBytes)(2)
        }, {
          blockSize: (0, _uint.readByte)()
        }, {
          preData: function preData(stream, result, parent) {
            return (0, _uint.readBytes)(parent.text.blockSize)(stream);
          }
        }, subBlocksSchema]
      }, function(stream) {
        var codes = (0, _uint.peekBytes)(2)(stream);
        return codes[0] === 33 && codes[1] === 1;
      });
      var applicationSchema = (0, _.conditional)({
        application: [{
          codes: (0, _uint.readBytes)(2)
        }, {
          blockSize: (0, _uint.readByte)()
        }, {
          id: function id(stream, result, parent) {
            return (0, _uint.readString)(parent.blockSize)(stream);
          }
        }, subBlocksSchema]
      }, function(stream) {
        var codes = (0, _uint.peekBytes)(2)(stream);
        return codes[0] === 33 && codes[1] === 255;
      });
      var commentSchema = (0, _.conditional)({
        comment: [{
          codes: (0, _uint.readBytes)(2)
        }, subBlocksSchema]
      }, function(stream) {
        var codes = (0, _uint.peekBytes)(2)(stream);
        return codes[0] === 33 && codes[1] === 254;
      });
      var schema = [
        {
          header: [{
            signature: (0, _uint.readString)(3)
          }, {
            version: (0, _uint.readString)(3)
          }]
        },
        {
          lsd: [{
            width: (0, _uint.readUnsigned)(true)
          }, {
            height: (0, _uint.readUnsigned)(true)
          }, {
            gct: (0, _uint.readBits)({
              exists: {
                index: 0
              },
              resolution: {
                index: 1,
                length: 3
              },
              sort: {
                index: 4
              },
              size: {
                index: 5,
                length: 3
              }
            })
          }, {
            backgroundColorIndex: (0, _uint.readByte)()
          }, {
            pixelAspectRatio: (0, _uint.readByte)()
          }]
        },
        (0, _.conditional)({
          gct: (0, _uint.readArray)(3, function(stream, result) {
            return Math.pow(2, result.lsd.gct.size + 1);
          })
        }, function(stream, result) {
          return result.lsd.gct.exists;
        }),
        // content frames
        {
          frames: (0, _.loop)([gceSchema, applicationSchema, commentSchema, imageSchema, textSchema], function(stream) {
            var nextCode = (0, _uint.peekByte)()(stream);
            return nextCode === 33 || nextCode === 44;
          })
        }
      ];
      var _default = schema;
      exports["default"] = _default;
    }
  });

  // node_modules/gifuct-js/src/index.js
  var index_exports = {};
  __export(index_exports, {
    decompressFrame: () => decompressFrame,
    decompressFrames: () => decompressFrames,
    parseGIF: () => parseGIF
  });
  var import_gif = __toESM(require_gif());
  var import_js_binary_schema_parser = __toESM(require_lib());
  var import_uint8 = __toESM(require_uint8());

  // node_modules/gifuct-js/src/deinterlace.js
  var deinterlace = (pixels, width) => {
    const newPixels = new Array(pixels.length);
    const rows = pixels.length / width;
    const cpRow = function(toRow2, fromRow2) {
      const fromPixels = pixels.slice(fromRow2 * width, (fromRow2 + 1) * width);
      newPixels.splice.apply(newPixels, [toRow2 * width, width].concat(fromPixels));
    };
    const offsets = [0, 4, 2, 1];
    const steps = [8, 8, 4, 2];
    var fromRow = 0;
    for (var pass = 0; pass < 4; pass++) {
      for (var toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
        cpRow(toRow, fromRow);
        fromRow++;
      }
    }
    return newPixels;
  };

  // node_modules/gifuct-js/src/lzw.js
  var lzw = (minCodeSize, data, pixelCount) => {
    const MAX_STACK_SIZE = 4096;
    const nullCode = -1;
    const npix = pixelCount;
    var available, clear, code_mask, code_size, end_of_information, in_code, old_code, bits, code, i, datum, data_size, first, top, bi, pi;
    const dstPixels = new Array(pixelCount);
    const prefix = new Array(MAX_STACK_SIZE);
    const suffix = new Array(MAX_STACK_SIZE);
    const pixelStack = new Array(MAX_STACK_SIZE + 1);
    data_size = minCodeSize;
    clear = 1 << data_size;
    end_of_information = clear + 1;
    available = clear + 2;
    old_code = nullCode;
    code_size = data_size + 1;
    code_mask = (1 << code_size) - 1;
    for (code = 0; code < clear; code++) {
      prefix[code] = 0;
      suffix[code] = code;
    }
    var datum, bits, count, first, top, pi, bi;
    datum = bits = count = first = top = pi = bi = 0;
    for (i = 0; i < npix; ) {
      if (top === 0) {
        if (bits < code_size) {
          datum += data[bi] << bits;
          bits += 8;
          bi++;
          continue;
        }
        code = datum & code_mask;
        datum >>= code_size;
        bits -= code_size;
        if (code > available || code == end_of_information) {
          break;
        }
        if (code == clear) {
          code_size = data_size + 1;
          code_mask = (1 << code_size) - 1;
          available = clear + 2;
          old_code = nullCode;
          continue;
        }
        if (old_code == nullCode) {
          pixelStack[top++] = suffix[code];
          old_code = code;
          first = code;
          continue;
        }
        in_code = code;
        if (code == available) {
          pixelStack[top++] = first;
          code = old_code;
        }
        while (code > clear) {
          pixelStack[top++] = suffix[code];
          code = prefix[code];
        }
        first = suffix[code] & 255;
        pixelStack[top++] = first;
        if (available < MAX_STACK_SIZE) {
          prefix[available] = old_code;
          suffix[available] = first;
          available++;
          if ((available & code_mask) === 0 && available < MAX_STACK_SIZE) {
            code_size++;
            code_mask += available;
          }
        }
        old_code = in_code;
      }
      top--;
      dstPixels[pi++] = pixelStack[top];
      i++;
    }
    for (i = pi; i < npix; i++) {
      dstPixels[i] = 0;
    }
    return dstPixels;
  };

  // node_modules/gifuct-js/src/index.js
  var parseGIF = (arrayBuffer) => {
    const byteData = new Uint8Array(arrayBuffer);
    return (0, import_js_binary_schema_parser.parse)((0, import_uint8.buildStream)(byteData), import_gif.default);
  };
  var generatePatch = (image) => {
    const totalPixels = image.pixels.length;
    const patchData = new Uint8ClampedArray(totalPixels * 4);
    for (var i = 0; i < totalPixels; i++) {
      const pos = i * 4;
      const colorIndex = image.pixels[i];
      const color = image.colorTable[colorIndex] || [0, 0, 0];
      patchData[pos] = color[0];
      patchData[pos + 1] = color[1];
      patchData[pos + 2] = color[2];
      patchData[pos + 3] = colorIndex !== image.transparentIndex ? 255 : 0;
    }
    return patchData;
  };
  var decompressFrame = (frame, gct, buildImagePatch) => {
    if (!frame.image) {
      console.warn("gif frame does not have associated image.");
      return;
    }
    const { image } = frame;
    const totalPixels = image.descriptor.width * image.descriptor.height;
    var pixels = lzw(image.data.minCodeSize, image.data.blocks, totalPixels);
    if (image.descriptor.lct.interlaced) {
      pixels = deinterlace(pixels, image.descriptor.width);
    }
    const resultImage = {
      pixels,
      dims: {
        top: frame.image.descriptor.top,
        left: frame.image.descriptor.left,
        width: frame.image.descriptor.width,
        height: frame.image.descriptor.height
      }
    };
    if (image.descriptor.lct && image.descriptor.lct.exists) {
      resultImage.colorTable = image.lct;
    } else {
      resultImage.colorTable = gct;
    }
    if (frame.gce) {
      resultImage.delay = (frame.gce.delay || 10) * 10;
      resultImage.disposalType = frame.gce.extras.disposal;
      if (frame.gce.extras.transparentColorGiven) {
        resultImage.transparentIndex = frame.gce.transparentColorIndex;
      }
    }
    if (buildImagePatch) {
      resultImage.patch = generatePatch(resultImage);
    }
    return resultImage;
  };
  var decompressFrames = (parsedGif, buildImagePatches) => {
    return parsedGif.frames.filter((f) => f.image).map((f) => decompressFrame(f, parsedGif.gct, buildImagePatches));
  };
  return __toCommonJS(index_exports);
})();
