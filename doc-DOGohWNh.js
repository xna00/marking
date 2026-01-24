function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var UZIP$1 = { exports: {} };
var hasRequiredUZIP;
function requireUZIP() {
  if (hasRequiredUZIP) return UZIP$1.exports;
  hasRequiredUZIP = 1;
  (function(module) {
    var UZIP2 = {};
    module.exports = UZIP2;
    UZIP2["parse"] = function(buf, onlyNames) {
      var rUs = UZIP2.bin.readUshort, rUi = UZIP2.bin.readUint, o = 0, out = {};
      var data = new Uint8Array(buf);
      var eocd = data.length - 4;
      while (rUi(data, eocd) != 101010256) eocd--;
      var o = eocd;
      o += 4;
      o += 4;
      var cnu = rUs(data, o);
      o += 2;
      rUs(data, o);
      o += 2;
      var csize = rUi(data, o);
      o += 4;
      var coffs = rUi(data, o);
      o += 4;
      o = coffs;
      for (var i = 0; i < cnu; i++) {
        rUi(data, o);
        o += 4;
        o += 4;
        o += 4;
        o += 4;
        rUi(data, o);
        o += 4;
        var csize = rUi(data, o);
        o += 4;
        var usize = rUi(data, o);
        o += 4;
        var nl = rUs(data, o), el = rUs(data, o + 2), cl = rUs(data, o + 4);
        o += 6;
        o += 8;
        var roff = rUi(data, o);
        o += 4;
        o += nl + el + cl;
        UZIP2._readLocal(data, roff, out, csize, usize, onlyNames);
      }
      return out;
    };
    UZIP2._readLocal = function(data, o, out, csize, usize, onlyNames) {
      var rUs = UZIP2.bin.readUshort, rUi = UZIP2.bin.readUint;
      rUi(data, o);
      o += 4;
      rUs(data, o);
      o += 2;
      rUs(data, o);
      o += 2;
      var cmpr = rUs(data, o);
      o += 2;
      rUi(data, o);
      o += 4;
      rUi(data, o);
      o += 4;
      o += 8;
      var nlen = rUs(data, o);
      o += 2;
      var elen = rUs(data, o);
      o += 2;
      var name = UZIP2.bin.readUTF8(data, o, nlen);
      o += nlen;
      o += elen;
      if (onlyNames) {
        out[name] = { size: usize, csize };
        return;
      }
      var file = new Uint8Array(data.buffer, o);
      if (cmpr == 0) out[name] = new Uint8Array(file.buffer.slice(o, o + csize));
      else if (cmpr == 8) {
        var buf = new Uint8Array(usize);
        UZIP2.inflateRaw(file, buf);
        out[name] = buf;
      } else throw "unknown compression method: " + cmpr;
    };
    UZIP2.inflateRaw = function(file, buf) {
      return UZIP2.F.inflate(file, buf);
    };
    UZIP2.inflate = function(file, buf) {
      file[0];
      file[1];
      return UZIP2.inflateRaw(new Uint8Array(file.buffer, file.byteOffset + 2, file.length - 6), buf);
    };
    UZIP2.deflate = function(data, opts) {
      if (opts == null) opts = { level: 6 };
      var off = 0, buf = new Uint8Array(50 + Math.floor(data.length * 1.1));
      buf[off] = 120;
      buf[off + 1] = 156;
      off += 2;
      off = UZIP2.F.deflateRaw(data, buf, off, opts.level);
      var crc = UZIP2.adler(data, 0, data.length);
      buf[off + 0] = crc >>> 24 & 255;
      buf[off + 1] = crc >>> 16 & 255;
      buf[off + 2] = crc >>> 8 & 255;
      buf[off + 3] = crc >>> 0 & 255;
      return new Uint8Array(buf.buffer, 0, off + 4);
    };
    UZIP2.deflateRaw = function(data, opts) {
      if (opts == null) opts = { level: 6 };
      var buf = new Uint8Array(50 + Math.floor(data.length * 1.1));
      var off = UZIP2.F.deflateRaw(data, buf, off, opts.level);
      return new Uint8Array(buf.buffer, 0, off);
    };
    UZIP2.encode = function(obj, noCmpr) {
      if (noCmpr == null) noCmpr = false;
      var tot = 0, wUi = UZIP2.bin.writeUint, wUs = UZIP2.bin.writeUshort;
      var zpd = {};
      for (var p in obj) {
        var cpr = !UZIP2._noNeed(p) && !noCmpr, buf = obj[p], crc = UZIP2.crc.crc(buf, 0, buf.length);
        zpd[p] = { cpr, usize: buf.length, crc, file: cpr ? UZIP2.deflateRaw(buf) : buf };
      }
      for (var p in zpd) tot += zpd[p].file.length + 30 + 46 + 2 * UZIP2.bin.sizeUTF8(p);
      tot += 22;
      var data = new Uint8Array(tot), o = 0;
      var fof = [];
      for (var p in zpd) {
        var file = zpd[p];
        fof.push(o);
        o = UZIP2._writeHeader(data, o, p, file, 0);
      }
      var i = 0, ioff = o;
      for (var p in zpd) {
        var file = zpd[p];
        fof.push(o);
        o = UZIP2._writeHeader(data, o, p, file, 1, fof[i++]);
      }
      var csize = o - ioff;
      wUi(data, o, 101010256);
      o += 4;
      o += 4;
      wUs(data, o, i);
      o += 2;
      wUs(data, o, i);
      o += 2;
      wUi(data, o, csize);
      o += 4;
      wUi(data, o, ioff);
      o += 4;
      o += 2;
      return data.buffer;
    };
    UZIP2._noNeed = function(fn) {
      var ext = fn.split(".").pop().toLowerCase();
      return "png,jpg,jpeg,zip".indexOf(ext) != -1;
    };
    UZIP2._writeHeader = function(data, o, p, obj, t, roff) {
      var wUi = UZIP2.bin.writeUint, wUs = UZIP2.bin.writeUshort;
      var file = obj.file;
      wUi(data, o, t == 0 ? 67324752 : 33639248);
      o += 4;
      if (t == 1) o += 2;
      wUs(data, o, 20);
      o += 2;
      wUs(data, o, 0);
      o += 2;
      wUs(data, o, obj.cpr ? 8 : 0);
      o += 2;
      wUi(data, o, 0);
      o += 4;
      wUi(data, o, obj.crc);
      o += 4;
      wUi(data, o, file.length);
      o += 4;
      wUi(data, o, obj.usize);
      o += 4;
      wUs(data, o, UZIP2.bin.sizeUTF8(p));
      o += 2;
      wUs(data, o, 0);
      o += 2;
      if (t == 1) {
        o += 2;
        o += 2;
        o += 6;
        wUi(data, o, roff);
        o += 4;
      }
      var nlen = UZIP2.bin.writeUTF8(data, o, p);
      o += nlen;
      if (t == 0) {
        data.set(file, o);
        o += file.length;
      }
      return o;
    };
    UZIP2.crc = {
      table: (function() {
        var tab = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
          var c = n;
          for (var k = 0; k < 8; k++) {
            if (c & 1) c = 3988292384 ^ c >>> 1;
            else c = c >>> 1;
          }
          tab[n] = c;
        }
        return tab;
      })(),
      update: function(c, buf, off, len) {
        for (var i = 0; i < len; i++) c = UZIP2.crc.table[(c ^ buf[off + i]) & 255] ^ c >>> 8;
        return c;
      },
      crc: function(b, o, l) {
        return UZIP2.crc.update(4294967295, b, o, l) ^ 4294967295;
      }
    };
    UZIP2.adler = function(data, o, len) {
      var a = 1, b = 0;
      var off = o, end = o + len;
      while (off < end) {
        var eend = Math.min(off + 5552, end);
        while (off < eend) {
          a += data[off++];
          b += a;
        }
        a = a % 65521;
        b = b % 65521;
      }
      return b << 16 | a;
    };
    UZIP2.bin = {
      readUshort: function(buff, p) {
        return buff[p] | buff[p + 1] << 8;
      },
      writeUshort: function(buff, p, n) {
        buff[p] = n & 255;
        buff[p + 1] = n >> 8 & 255;
      },
      readUint: function(buff, p) {
        return buff[p + 3] * (256 * 256 * 256) + (buff[p + 2] << 16 | buff[p + 1] << 8 | buff[p]);
      },
      writeUint: function(buff, p, n) {
        buff[p] = n & 255;
        buff[p + 1] = n >> 8 & 255;
        buff[p + 2] = n >> 16 & 255;
        buff[p + 3] = n >> 24 & 255;
      },
      readASCII: function(buff, p, l) {
        var s = "";
        for (var i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]);
        return s;
      },
      writeASCII: function(data, p, s) {
        for (var i = 0; i < s.length; i++) data[p + i] = s.charCodeAt(i);
      },
      pad: function(n) {
        return n.length < 2 ? "0" + n : n;
      },
      readUTF8: function(buff, p, l) {
        var s = "", ns;
        for (var i = 0; i < l; i++) s += "%" + UZIP2.bin.pad(buff[p + i].toString(16));
        try {
          ns = decodeURIComponent(s);
        } catch (e) {
          return UZIP2.bin.readASCII(buff, p, l);
        }
        return ns;
      },
      writeUTF8: function(buff, p, str) {
        var strl = str.length, i = 0;
        for (var ci = 0; ci < strl; ci++) {
          var code = str.charCodeAt(ci);
          if ((code & 4294967295 - (1 << 7) + 1) == 0) {
            buff[p + i] = code;
            i++;
          } else if ((code & 4294967295 - (1 << 11) + 1) == 0) {
            buff[p + i] = 192 | code >> 6;
            buff[p + i + 1] = 128 | code >> 0 & 63;
            i += 2;
          } else if ((code & 4294967295 - (1 << 16) + 1) == 0) {
            buff[p + i] = 224 | code >> 12;
            buff[p + i + 1] = 128 | code >> 6 & 63;
            buff[p + i + 2] = 128 | code >> 0 & 63;
            i += 3;
          } else if ((code & 4294967295 - (1 << 21) + 1) == 0) {
            buff[p + i] = 240 | code >> 18;
            buff[p + i + 1] = 128 | code >> 12 & 63;
            buff[p + i + 2] = 128 | code >> 6 & 63;
            buff[p + i + 3] = 128 | code >> 0 & 63;
            i += 4;
          } else throw "e";
        }
        return i;
      },
      sizeUTF8: function(str) {
        var strl = str.length, i = 0;
        for (var ci = 0; ci < strl; ci++) {
          var code = str.charCodeAt(ci);
          if ((code & 4294967295 - (1 << 7) + 1) == 0) {
            i++;
          } else if ((code & 4294967295 - (1 << 11) + 1) == 0) {
            i += 2;
          } else if ((code & 4294967295 - (1 << 16) + 1) == 0) {
            i += 3;
          } else if ((code & 4294967295 - (1 << 21) + 1) == 0) {
            i += 4;
          } else throw "e";
        }
        return i;
      }
    };
    UZIP2.F = {};
    UZIP2.F.deflateRaw = function(data, out, opos, lvl) {
      var opts = [
        /*
        	 ush good_length; /* reduce lazy search above this match length 
        	 ush max_lazy;    /* do not perform lazy search above this match length 
                ush nice_length; /* quit search above this match length 
        */
        /*      good lazy nice chain */
        /* 0 */
        [0, 0, 0, 0, 0],
        /* store only */
        /* 1 */
        [4, 4, 8, 4, 0],
        /* max speed, no lazy matches */
        /* 2 */
        [4, 5, 16, 8, 0],
        /* 3 */
        [4, 6, 16, 16, 0],
        /* 4 */
        [4, 10, 16, 32, 0],
        /* lazy matches */
        /* 5 */
        [8, 16, 32, 32, 0],
        /* 6 */
        [8, 16, 128, 128, 0],
        /* 7 */
        [8, 32, 128, 256, 0],
        /* 8 */
        [32, 128, 258, 1024, 1],
        /* 9 */
        [32, 258, 258, 4096, 1]
      ];
      var opt = opts[lvl];
      var U = UZIP2.F.U, goodIndex = UZIP2.F._goodIndex;
      UZIP2.F._hash;
      var putsE = UZIP2.F._putsE;
      var i = 0, pos = opos << 3, cvrd = 0, dlen = data.length;
      if (lvl == 0) {
        while (i < dlen) {
          var len = Math.min(65535, dlen - i);
          putsE(out, pos, i + len == dlen ? 1 : 0);
          pos = UZIP2.F._copyExact(data, i, len, out, pos + 8);
          i += len;
        }
        return pos >>> 3;
      }
      var lits = U.lits, strt = U.strt, prev = U.prev, li = 0, lc = 0, bs = 0, ebits = 0, c = 0, nc = 0;
      if (dlen > 2) {
        nc = UZIP2.F._hash(data, 0);
        strt[nc] = 0;
      }
      for (i = 0; i < dlen; i++) {
        c = nc;
        if (i + 1 < dlen - 2) {
          nc = UZIP2.F._hash(data, i + 1);
          var ii = i + 1 & 32767;
          prev[ii] = strt[nc];
          strt[nc] = ii;
        }
        if (cvrd <= i) {
          if ((li > 14e3 || lc > 26697) && dlen - i > 100) {
            if (cvrd < i) {
              lits[li] = i - cvrd;
              li += 2;
              cvrd = i;
            }
            pos = UZIP2.F._writeBlock(i == dlen - 1 || cvrd == dlen ? 1 : 0, lits, li, ebits, data, bs, i - bs, out, pos);
            li = lc = ebits = 0;
            bs = i;
          }
          var mch = 0;
          if (i < dlen - 2) mch = UZIP2.F._bestMatch(data, i, prev, c, Math.min(opt[2], dlen - i), opt[3]);
          var len = mch >>> 16, dst = mch & 65535;
          if (mch != 0) {
            var len = mch >>> 16, dst = mch & 65535;
            var lgi = goodIndex(len, U.of0);
            U.lhst[257 + lgi]++;
            var dgi = goodIndex(dst, U.df0);
            U.dhst[dgi]++;
            ebits += U.exb[lgi] + U.dxb[dgi];
            lits[li] = len << 23 | i - cvrd;
            lits[li + 1] = dst << 16 | lgi << 8 | dgi;
            li += 2;
            cvrd = i + len;
          } else {
            U.lhst[data[i]]++;
          }
          lc++;
        }
      }
      if (bs != i || data.length == 0) {
        if (cvrd < i) {
          lits[li] = i - cvrd;
          li += 2;
          cvrd = i;
        }
        pos = UZIP2.F._writeBlock(1, lits, li, ebits, data, bs, i - bs, out, pos);
        li = 0;
        lc = 0;
        li = lc = ebits = 0;
        bs = i;
      }
      while ((pos & 7) != 0) pos++;
      return pos >>> 3;
    };
    UZIP2.F._bestMatch = function(data, i, prev, c, nice, chain) {
      var ci = i & 32767, pi = prev[ci];
      var dif = ci - pi + (1 << 15) & 32767;
      if (pi == ci || c != UZIP2.F._hash(data, i - dif)) return 0;
      var tl = 0, td = 0;
      var dlim = Math.min(32767, i);
      while (dif <= dlim && --chain != 0 && pi != ci) {
        if (tl == 0 || data[i + tl] == data[i + tl - dif]) {
          var cl = UZIP2.F._howLong(data, i, dif);
          if (cl > tl) {
            tl = cl;
            td = dif;
            if (tl >= nice) break;
            if (dif + 2 < cl) cl = dif + 2;
            var maxd = 0;
            for (var j = 0; j < cl - 2; j++) {
              var ei = i - dif + j + (1 << 15) & 32767;
              var li = prev[ei];
              var curd = ei - li + (1 << 15) & 32767;
              if (curd > maxd) {
                maxd = curd;
                pi = ei;
              }
            }
          }
        }
        ci = pi;
        pi = prev[ci];
        dif += ci - pi + (1 << 15) & 32767;
      }
      return tl << 16 | td;
    };
    UZIP2.F._howLong = function(data, i, dif) {
      if (data[i] != data[i - dif] || data[i + 1] != data[i + 1 - dif] || data[i + 2] != data[i + 2 - dif]) return 0;
      var oi = i, l = Math.min(data.length, i + 258);
      i += 3;
      while (i < l && data[i] == data[i - dif]) i++;
      return i - oi;
    };
    UZIP2.F._hash = function(data, i) {
      return (data[i] << 8 | data[i + 1]) + (data[i + 2] << 4) & 65535;
    };
    UZIP2.saved = 0;
    UZIP2.F._writeBlock = function(BFINAL, lits, li, ebits, data, o0, l0, out, pos) {
      var U = UZIP2.F.U, putsF = UZIP2.F._putsF, putsE = UZIP2.F._putsE;
      var T, ML, MD, MH, numl, numd, numh, lset, dset;
      U.lhst[256]++;
      T = UZIP2.F.getTrees();
      ML = T[0];
      MD = T[1];
      MH = T[2];
      numl = T[3];
      numd = T[4];
      numh = T[5];
      lset = T[6];
      dset = T[7];
      var cstSize = ((pos + 3 & 7) == 0 ? 0 : 8 - (pos + 3 & 7)) + 32 + (l0 << 3);
      var fxdSize = ebits + UZIP2.F.contSize(U.fltree, U.lhst) + UZIP2.F.contSize(U.fdtree, U.dhst);
      var dynSize = ebits + UZIP2.F.contSize(U.ltree, U.lhst) + UZIP2.F.contSize(U.dtree, U.dhst);
      dynSize += 14 + 3 * numh + UZIP2.F.contSize(U.itree, U.ihst) + (U.ihst[16] * 2 + U.ihst[17] * 3 + U.ihst[18] * 7);
      for (var j = 0; j < 286; j++) U.lhst[j] = 0;
      for (var j = 0; j < 30; j++) U.dhst[j] = 0;
      for (var j = 0; j < 19; j++) U.ihst[j] = 0;
      var BTYPE = cstSize < fxdSize && cstSize < dynSize ? 0 : fxdSize < dynSize ? 1 : 2;
      putsF(out, pos, BFINAL);
      putsF(out, pos + 1, BTYPE);
      pos += 3;
      if (BTYPE == 0) {
        while ((pos & 7) != 0) pos++;
        pos = UZIP2.F._copyExact(data, o0, l0, out, pos);
      } else {
        var ltree, dtree;
        if (BTYPE == 1) {
          ltree = U.fltree;
          dtree = U.fdtree;
        }
        if (BTYPE == 2) {
          UZIP2.F.makeCodes(U.ltree, ML);
          UZIP2.F.revCodes(U.ltree, ML);
          UZIP2.F.makeCodes(U.dtree, MD);
          UZIP2.F.revCodes(U.dtree, MD);
          UZIP2.F.makeCodes(U.itree, MH);
          UZIP2.F.revCodes(U.itree, MH);
          ltree = U.ltree;
          dtree = U.dtree;
          putsE(out, pos, numl - 257);
          pos += 5;
          putsE(out, pos, numd - 1);
          pos += 5;
          putsE(out, pos, numh - 4);
          pos += 4;
          for (var i = 0; i < numh; i++) putsE(out, pos + i * 3, U.itree[(U.ordr[i] << 1) + 1]);
          pos += 3 * numh;
          pos = UZIP2.F._codeTiny(lset, U.itree, out, pos);
          pos = UZIP2.F._codeTiny(dset, U.itree, out, pos);
        }
        var off = o0;
        for (var si = 0; si < li; si += 2) {
          var qb = lits[si], len = qb >>> 23, end = off + (qb & (1 << 23) - 1);
          while (off < end) pos = UZIP2.F._writeLit(data[off++], ltree, out, pos);
          if (len != 0) {
            var qc = lits[si + 1], dst = qc >> 16, lgi = qc >> 8 & 255, dgi = qc & 255;
            pos = UZIP2.F._writeLit(257 + lgi, ltree, out, pos);
            putsE(out, pos, len - U.of0[lgi]);
            pos += U.exb[lgi];
            pos = UZIP2.F._writeLit(dgi, dtree, out, pos);
            putsF(out, pos, dst - U.df0[dgi]);
            pos += U.dxb[dgi];
            off += len;
          }
        }
        pos = UZIP2.F._writeLit(256, ltree, out, pos);
      }
      return pos;
    };
    UZIP2.F._copyExact = function(data, off, len, out, pos) {
      var p8 = pos >>> 3;
      out[p8] = len;
      out[p8 + 1] = len >>> 8;
      out[p8 + 2] = 255 - out[p8];
      out[p8 + 3] = 255 - out[p8 + 1];
      p8 += 4;
      out.set(new Uint8Array(data.buffer, off, len), p8);
      return pos + (len + 4 << 3);
    };
    UZIP2.F.getTrees = function() {
      var U = UZIP2.F.U;
      var ML = UZIP2.F._hufTree(U.lhst, U.ltree, 15);
      var MD = UZIP2.F._hufTree(U.dhst, U.dtree, 15);
      var lset = [], numl = UZIP2.F._lenCodes(U.ltree, lset);
      var dset = [], numd = UZIP2.F._lenCodes(U.dtree, dset);
      for (var i = 0; i < lset.length; i += 2) U.ihst[lset[i]]++;
      for (var i = 0; i < dset.length; i += 2) U.ihst[dset[i]]++;
      var MH = UZIP2.F._hufTree(U.ihst, U.itree, 7);
      var numh = 19;
      while (numh > 4 && U.itree[(U.ordr[numh - 1] << 1) + 1] == 0) numh--;
      return [ML, MD, MH, numl, numd, numh, lset, dset];
    };
    UZIP2.F.getSecond = function(a) {
      var b = [];
      for (var i = 0; i < a.length; i += 2) b.push(a[i + 1]);
      return b;
    };
    UZIP2.F.nonZero = function(a) {
      var b = "";
      for (var i = 0; i < a.length; i += 2) if (a[i + 1] != 0) b += (i >> 1) + ",";
      return b;
    };
    UZIP2.F.contSize = function(tree, hst) {
      var s = 0;
      for (var i = 0; i < hst.length; i++) s += hst[i] * tree[(i << 1) + 1];
      return s;
    };
    UZIP2.F._codeTiny = function(set, tree, out, pos) {
      for (var i = 0; i < set.length; i += 2) {
        var l = set[i], rst = set[i + 1];
        pos = UZIP2.F._writeLit(l, tree, out, pos);
        var rsl = l == 16 ? 2 : l == 17 ? 3 : 7;
        if (l > 15) {
          UZIP2.F._putsE(out, pos, rst, rsl);
          pos += rsl;
        }
      }
      return pos;
    };
    UZIP2.F._lenCodes = function(tree, set) {
      var len = tree.length;
      while (len != 2 && tree[len - 1] == 0) len -= 2;
      for (var i = 0; i < len; i += 2) {
        var l = tree[i + 1], nxt = i + 3 < len ? tree[i + 3] : -1, nnxt = i + 5 < len ? tree[i + 5] : -1, prv = i == 0 ? -1 : tree[i - 1];
        if (l == 0 && nxt == l && nnxt == l) {
          var lz = i + 5;
          while (lz + 2 < len && tree[lz + 2] == l) lz += 2;
          var zc = Math.min(lz + 1 - i >>> 1, 138);
          if (zc < 11) set.push(17, zc - 3);
          else set.push(18, zc - 11);
          i += zc * 2 - 2;
        } else if (l == prv && nxt == l && nnxt == l) {
          var lz = i + 5;
          while (lz + 2 < len && tree[lz + 2] == l) lz += 2;
          var zc = Math.min(lz + 1 - i >>> 1, 6);
          set.push(16, zc - 3);
          i += zc * 2 - 2;
        } else set.push(l, 0);
      }
      return len >>> 1;
    };
    UZIP2.F._hufTree = function(hst, tree, MAXL) {
      var list = [], hl = hst.length, tl = tree.length, i = 0;
      for (i = 0; i < tl; i += 2) {
        tree[i] = 0;
        tree[i + 1] = 0;
      }
      for (i = 0; i < hl; i++) if (hst[i] != 0) list.push({ lit: i, f: hst[i] });
      var end = list.length, l2 = list.slice(0);
      if (end == 0) return 0;
      if (end == 1) {
        var lit = list[0].lit, l2 = lit == 0 ? 1 : 0;
        tree[(lit << 1) + 1] = 1;
        tree[(l2 << 1) + 1] = 1;
        return 1;
      }
      list.sort(function(a2, b2) {
        return a2.f - b2.f;
      });
      var a = list[0], b = list[1], i0 = 0, i1 = 1, i2 = 2;
      list[0] = { lit: -1, f: a.f + b.f, l: a, r: b, d: 0 };
      while (i1 != end - 1) {
        if (i0 != i1 && (i2 == end || list[i0].f < list[i2].f)) {
          a = list[i0++];
        } else {
          a = list[i2++];
        }
        if (i0 != i1 && (i2 == end || list[i0].f < list[i2].f)) {
          b = list[i0++];
        } else {
          b = list[i2++];
        }
        list[i1++] = { lit: -1, f: a.f + b.f, l: a, r: b };
      }
      var maxl = UZIP2.F.setDepth(list[i1 - 1], 0);
      if (maxl > MAXL) {
        UZIP2.F.restrictDepth(l2, MAXL, maxl);
        maxl = MAXL;
      }
      for (i = 0; i < end; i++) tree[(l2[i].lit << 1) + 1] = l2[i].d;
      return maxl;
    };
    UZIP2.F.setDepth = function(t, d) {
      if (t.lit != -1) {
        t.d = d;
        return d;
      }
      return Math.max(UZIP2.F.setDepth(t.l, d + 1), UZIP2.F.setDepth(t.r, d + 1));
    };
    UZIP2.F.restrictDepth = function(dps, MD, maxl) {
      var i = 0, bCost = 1 << maxl - MD, dbt = 0;
      dps.sort(function(a, b) {
        return b.d == a.d ? a.f - b.f : b.d - a.d;
      });
      for (i = 0; i < dps.length; i++) if (dps[i].d > MD) {
        var od = dps[i].d;
        dps[i].d = MD;
        dbt += bCost - (1 << maxl - od);
      } else break;
      dbt = dbt >>> maxl - MD;
      while (dbt > 0) {
        var od = dps[i].d;
        if (od < MD) {
          dps[i].d++;
          dbt -= 1 << MD - od - 1;
        } else i++;
      }
      for (; i >= 0; i--) if (dps[i].d == MD && dbt < 0) {
        dps[i].d--;
        dbt++;
      }
      if (dbt != 0) console.log("debt left");
    };
    UZIP2.F._goodIndex = function(v, arr) {
      var i = 0;
      if (arr[i | 16] <= v) i |= 16;
      if (arr[i | 8] <= v) i |= 8;
      if (arr[i | 4] <= v) i |= 4;
      if (arr[i | 2] <= v) i |= 2;
      if (arr[i | 1] <= v) i |= 1;
      return i;
    };
    UZIP2.F._writeLit = function(ch, ltree, out, pos) {
      UZIP2.F._putsF(out, pos, ltree[ch << 1]);
      return pos + ltree[(ch << 1) + 1];
    };
    UZIP2.F.inflate = function(data, buf) {
      var u8 = Uint8Array;
      if (data[0] == 3 && data[1] == 0) return buf ? buf : new u8(0);
      var F = UZIP2.F, bitsF = F._bitsF, bitsE = F._bitsE, decodeTiny = F._decodeTiny, makeCodes = F.makeCodes, codes2map = F.codes2map, get17 = F._get17;
      var U = F.U;
      var noBuf = buf == null;
      if (noBuf) buf = new u8(data.length >>> 2 << 3);
      var BFINAL = 0, BTYPE = 0, HLIT = 0, HDIST = 0, HCLEN = 0, ML = 0, MD = 0;
      var off = 0, pos = 0;
      var lmap, dmap;
      while (BFINAL == 0) {
        BFINAL = bitsF(data, pos, 1);
        BTYPE = bitsF(data, pos + 1, 2);
        pos += 3;
        if (BTYPE == 0) {
          if ((pos & 7) != 0) pos += 8 - (pos & 7);
          var p8 = (pos >>> 3) + 4, len = data[p8 - 4] | data[p8 - 3] << 8;
          if (noBuf) buf = UZIP2.F._check(buf, off + len);
          buf.set(new u8(data.buffer, data.byteOffset + p8, len), off);
          pos = p8 + len << 3;
          off += len;
          continue;
        }
        if (noBuf) buf = UZIP2.F._check(buf, off + (1 << 17));
        if (BTYPE == 1) {
          lmap = U.flmap;
          dmap = U.fdmap;
          ML = (1 << 9) - 1;
          MD = (1 << 5) - 1;
        }
        if (BTYPE == 2) {
          HLIT = bitsE(data, pos, 5) + 257;
          HDIST = bitsE(data, pos + 5, 5) + 1;
          HCLEN = bitsE(data, pos + 10, 4) + 4;
          pos += 14;
          for (var i = 0; i < 38; i += 2) {
            U.itree[i] = 0;
            U.itree[i + 1] = 0;
          }
          var tl = 1;
          for (var i = 0; i < HCLEN; i++) {
            var l = bitsE(data, pos + i * 3, 3);
            U.itree[(U.ordr[i] << 1) + 1] = l;
            if (l > tl) tl = l;
          }
          pos += 3 * HCLEN;
          makeCodes(U.itree, tl);
          codes2map(U.itree, tl, U.imap);
          lmap = U.lmap;
          dmap = U.dmap;
          pos = decodeTiny(U.imap, (1 << tl) - 1, HLIT + HDIST, data, pos, U.ttree);
          var mx0 = F._copyOut(U.ttree, 0, HLIT, U.ltree);
          ML = (1 << mx0) - 1;
          var mx1 = F._copyOut(U.ttree, HLIT, HDIST, U.dtree);
          MD = (1 << mx1) - 1;
          makeCodes(U.ltree, mx0);
          codes2map(U.ltree, mx0, lmap);
          makeCodes(U.dtree, mx1);
          codes2map(U.dtree, mx1, dmap);
        }
        while (true) {
          var code = lmap[get17(data, pos) & ML];
          pos += code & 15;
          var lit = code >>> 4;
          if (lit >>> 8 == 0) {
            buf[off++] = lit;
          } else if (lit == 256) {
            break;
          } else {
            var end = off + lit - 254;
            if (lit > 264) {
              var ebs = U.ldef[lit - 257];
              end = off + (ebs >>> 3) + bitsE(data, pos, ebs & 7);
              pos += ebs & 7;
            }
            var dcode = dmap[get17(data, pos) & MD];
            pos += dcode & 15;
            var dlit = dcode >>> 4;
            var dbs = U.ddef[dlit], dst = (dbs >>> 4) + bitsF(data, pos, dbs & 15);
            pos += dbs & 15;
            if (noBuf) buf = UZIP2.F._check(buf, off + (1 << 17));
            while (off < end) {
              buf[off] = buf[off++ - dst];
              buf[off] = buf[off++ - dst];
              buf[off] = buf[off++ - dst];
              buf[off] = buf[off++ - dst];
            }
            off = end;
          }
        }
      }
      return buf.length == off ? buf : buf.slice(0, off);
    };
    UZIP2.F._check = function(buf, len) {
      var bl = buf.length;
      if (len <= bl) return buf;
      var nbuf = new Uint8Array(Math.max(bl << 1, len));
      nbuf.set(buf, 0);
      return nbuf;
    };
    UZIP2.F._decodeTiny = function(lmap, LL, len, data, pos, tree) {
      var bitsE = UZIP2.F._bitsE, get17 = UZIP2.F._get17;
      var i = 0;
      while (i < len) {
        var code = lmap[get17(data, pos) & LL];
        pos += code & 15;
        var lit = code >>> 4;
        if (lit <= 15) {
          tree[i] = lit;
          i++;
        } else {
          var ll = 0, n = 0;
          if (lit == 16) {
            n = 3 + bitsE(data, pos, 2);
            pos += 2;
            ll = tree[i - 1];
          } else if (lit == 17) {
            n = 3 + bitsE(data, pos, 3);
            pos += 3;
          } else if (lit == 18) {
            n = 11 + bitsE(data, pos, 7);
            pos += 7;
          }
          var ni = i + n;
          while (i < ni) {
            tree[i] = ll;
            i++;
          }
        }
      }
      return pos;
    };
    UZIP2.F._copyOut = function(src, off, len, tree) {
      var mx = 0, i = 0, tl = tree.length >>> 1;
      while (i < len) {
        var v = src[i + off];
        tree[i << 1] = 0;
        tree[(i << 1) + 1] = v;
        if (v > mx) mx = v;
        i++;
      }
      while (i < tl) {
        tree[i << 1] = 0;
        tree[(i << 1) + 1] = 0;
        i++;
      }
      return mx;
    };
    UZIP2.F.makeCodes = function(tree, MAX_BITS) {
      var U = UZIP2.F.U;
      var max_code = tree.length;
      var code, bits, n, i, len;
      var bl_count = U.bl_count;
      for (var i = 0; i <= MAX_BITS; i++) bl_count[i] = 0;
      for (i = 1; i < max_code; i += 2) bl_count[tree[i]]++;
      var next_code = U.next_code;
      code = 0;
      bl_count[0] = 0;
      for (bits = 1; bits <= MAX_BITS; bits++) {
        code = code + bl_count[bits - 1] << 1;
        next_code[bits] = code;
      }
      for (n = 0; n < max_code; n += 2) {
        len = tree[n + 1];
        if (len != 0) {
          tree[n] = next_code[len];
          next_code[len]++;
        }
      }
    };
    UZIP2.F.codes2map = function(tree, MAX_BITS, map) {
      var max_code = tree.length;
      var U = UZIP2.F.U, r15 = U.rev15;
      for (var i = 0; i < max_code; i += 2) if (tree[i + 1] != 0) {
        var lit = i >> 1;
        var cl = tree[i + 1], val = lit << 4 | cl;
        var rest = MAX_BITS - cl, i0 = tree[i] << rest, i1 = i0 + (1 << rest);
        while (i0 != i1) {
          var p0 = r15[i0] >>> 15 - MAX_BITS;
          map[p0] = val;
          i0++;
        }
      }
    };
    UZIP2.F.revCodes = function(tree, MAX_BITS) {
      var r15 = UZIP2.F.U.rev15, imb = 15 - MAX_BITS;
      for (var i = 0; i < tree.length; i += 2) {
        var i0 = tree[i] << MAX_BITS - tree[i + 1];
        tree[i] = r15[i0] >>> imb;
      }
    };
    UZIP2.F._putsE = function(dt, pos, val) {
      val = val << (pos & 7);
      var o = pos >>> 3;
      dt[o] |= val;
      dt[o + 1] |= val >>> 8;
    };
    UZIP2.F._putsF = function(dt, pos, val) {
      val = val << (pos & 7);
      var o = pos >>> 3;
      dt[o] |= val;
      dt[o + 1] |= val >>> 8;
      dt[o + 2] |= val >>> 16;
    };
    UZIP2.F._bitsE = function(dt, pos, length) {
      return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8) >>> (pos & 7) & (1 << length) - 1;
    };
    UZIP2.F._bitsF = function(dt, pos, length) {
      return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16) >>> (pos & 7) & (1 << length) - 1;
    };
    UZIP2.F._get17 = function(dt, pos) {
      return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16) >>> (pos & 7);
    };
    UZIP2.F._get25 = function(dt, pos) {
      return (dt[pos >>> 3] | dt[(pos >>> 3) + 1] << 8 | dt[(pos >>> 3) + 2] << 16 | dt[(pos >>> 3) + 3] << 24) >>> (pos & 7);
    };
    UZIP2.F.U = (function() {
      var u16 = Uint16Array, u32 = Uint32Array;
      return {
        next_code: new u16(16),
        bl_count: new u16(16),
        ordr: [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
        of0: [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 999, 999, 999],
        exb: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0],
        ldef: new u16(32),
        df0: [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 65535, 65535],
        dxb: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0],
        ddef: new u32(32),
        flmap: new u16(512),
        fltree: [],
        fdmap: new u16(32),
        fdtree: [],
        lmap: new u16(32768),
        ltree: [],
        ttree: [],
        dmap: new u16(32768),
        dtree: [],
        imap: new u16(512),
        itree: [],
        //rev9 : new u16(  512)
        rev15: new u16(1 << 15),
        lhst: new u32(286),
        dhst: new u32(30),
        ihst: new u32(19),
        lits: new u32(15e3),
        strt: new u16(1 << 16),
        prev: new u16(1 << 15)
      };
    })();
    (function() {
      var U = UZIP2.F.U;
      var len = 1 << 15;
      for (var i = 0; i < len; i++) {
        var x = i;
        x = (x & 2863311530) >>> 1 | (x & 1431655765) << 1;
        x = (x & 3435973836) >>> 2 | (x & 858993459) << 2;
        x = (x & 4042322160) >>> 4 | (x & 252645135) << 4;
        x = (x & 4278255360) >>> 8 | (x & 16711935) << 8;
        U.rev15[i] = (x >>> 16 | x << 16) >>> 17;
      }
      function pushV(tgt, n, sv) {
        while (n-- != 0) tgt.push(0, sv);
      }
      for (var i = 0; i < 32; i++) {
        U.ldef[i] = U.of0[i] << 3 | U.exb[i];
        U.ddef[i] = U.df0[i] << 4 | U.dxb[i];
      }
      pushV(U.fltree, 144, 8);
      pushV(U.fltree, 255 - 143, 9);
      pushV(U.fltree, 279 - 255, 7);
      pushV(U.fltree, 287 - 279, 8);
      UZIP2.F.makeCodes(U.fltree, 9);
      UZIP2.F.codes2map(U.fltree, 9, U.flmap);
      UZIP2.F.revCodes(U.fltree, 9);
      pushV(U.fdtree, 32, 5);
      UZIP2.F.makeCodes(U.fdtree, 5);
      UZIP2.F.codes2map(U.fdtree, 5, U.fdmap);
      UZIP2.F.revCodes(U.fdtree, 5);
      pushV(U.itree, 19, 0);
      pushV(U.ltree, 286, 0);
      pushV(U.dtree, 30, 0);
      pushV(U.ttree, 320, 0);
    })();
  })(UZIP$1);
  return UZIP$1.exports;
}
var UZIPExports = requireUZIP();
const UZIP = /* @__PURE__ */ getDefaultExportFromCjs(UZIPExports);
fetch("./extension.zip", { cache: "no-cache" });
const downloadBtn = document.getElementById("download_btn");
const updateBtn = document.getElementById("update_btn");
const toast = document.getElementById("toast");
const showToast = (msg, duration = 2e3) => {
  toast.innerHTML = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, duration);
};
console.log(UZIP);
const directoryId = "directoryId";
const saveFilesInDirectory = async (dirHandle, files) => {
  return Promise.all(
    Object.entries(files).map(async ([p, fileContent]) => {
      if (!p) return;
      const filePath = p.split("/");
      if (filePath.length > 1) {
        const dir = await dirHandle.getDirectoryHandle(filePath[0], {
          create: true
        });
        await saveFilesInDirectory(dir, {
          [filePath.slice(1).join("/")]: fileContent
        });
      } else {
        const fileHandle = await dirHandle.getFileHandle(p, {
          create: true
        });
        const writable = await fileHandle.createWritable();
        await writable.write(fileContent.buffer);
        await writable.close();
      }
    })
  );
};
const saveExtensionFiles = async (dirHandle) => {
  const buf = await (await fetch("./extension.zip", {
    cache: "no-cache"
  })).arrayBuffer();
  showToast("下载完成，正在保存文件...");
  const files = UZIP.parse(buf);
  console.log(files);
  const f = Object.fromEntries(
    Object.entries(files).filter(([k, v]) => !k.endsWith("/")).map(([k, v]) => [k.replace("dist/extension/", ""), v])
  );
  await saveFilesInDirectory(dirHandle, f);
  showToast("更新完成，等待页面刷新...", 6e4);
};
downloadBtn.addEventListener("click", async function() {
  try {
    const dirHandle = await window.showDirectoryPicker({
      id: directoryId,
      mode: "readwrite"
    });
    console.log(dirHandle);
    await saveExtensionFiles(dirHandle);
  } catch (error) {
    console.error(error);
  }
});
updateBtn.addEventListener("click", async function() {
  try {
    const dirHandle = await window.showDirectoryPicker({
      id: directoryId,
      mode: "readwrite"
    });
    await saveExtensionFiles(dirHandle);
    const event = new CustomEvent("reloadExtension");
    document.dispatchEvent(event);
  } catch (error) {
    console.error(error);
  }
});
