        'use strict';

        if (localStorage.getItem('dev-preview-mode') === 'true') {
            document.getElementById('deleteMetadataBtn').style.display = 'inline-flex';
        }

        async function deleteMetadataAndDownload() {
            const previewImg = document.getElementById('previewImage');
            if (!previewImg || !previewImg.complete) return;

            const canvas = document.createElement('canvas');
            canvas.width = previewImg.naturalWidth;
            canvas.height = previewImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(previewImg, 0, 0);

            const formatBadge = document.getElementById('formatBadge');
            const format = (formatBadge?.textContent || 'PNG').toLowerCase();
            const mimeType = format.includes('jpeg') ? 'image/jpeg' :
                format.includes('png') ? 'image/png' :
                    format.includes('webp') ? 'image/webp' : 'image/png';
            const quality = mimeType === 'image/jpeg' ? 0.92 : undefined;

            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pixelpeek-cleaned-${Date.now()}.${mimeType.split('/')[1]}`;
                a.click();
                URL.revokeObjectURL(url);
            }, mimeType, quality);
        }

        document.getElementById('deleteMetadataBtn')?.addEventListener('click', deleteMetadataAndDownload);

        function formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            if (bytes == null) return null;
            const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
        }
        function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
        function computeAspectRatio(w, h) {
            if (!w || !h) return null;
            const d = gcd(w, h) || 1;
            return `${w / d}:${h / d} (${(w / h).toFixed(3)})`;
        }
        function getBaseName(name) { return (name || 'image').replace(/\.[^/.]+$/, ''); }
        function cleanExifStr(s) {
            if (s == null) return null;
            const t = String(s).trim();
            return t.length ? t : null;
        }
        function bytesToASCII(view, offset, length) {
            let s = '';
            for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(offset + i));
            return s;
        }

        const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

        function readTypedValue(view, base, type, count, little) {
            switch (type) {
                case 1: case 7: {
                    if (count === 1) return view.getUint8(base);
                    const arr = []; for (let i = 0; i < count; i++) arr.push(view.getUint8(base + i)); return arr;
                }
                case 6: {
                    if (count === 1) return view.getInt8(base);
                    const arr = []; for (let i = 0; i < count; i++) arr.push(view.getInt8(base + i)); return arr;
                }
                case 2: {
                    let s = ''; for (let i = 0; i < count; i++) { const c = view.getUint8(base + i); if (c === 0) break; s += String.fromCharCode(c); }
                    return s.trim();
                }
                case 3: case 8: {
                    const read = type === 3 ? (o) => view.getUint16(o, little) : (o) => view.getInt16(o, little);
                    if (count === 1) return read(base);
                    const arr = []; for (let i = 0; i < count; i++) arr.push(read(base + i * 2)); return arr;
                }
                case 4: case 9: {
                    const read = type === 4 ? (o) => view.getUint32(o, little) : (o) => view.getInt32(o, little);
                    if (count === 1) return read(base);
                    const arr = []; for (let i = 0; i < count; i++) arr.push(read(base + i * 4)); return arr;
                }
                case 5: case 10: {
                    const readNum = type === 5 ? (o) => view.getUint32(o, little) : (o) => view.getInt32(o, little);
                    const readOne = (o) => { const num = readNum(o), den = readNum(o + 4); return { num, den, value: den !== 0 ? num / den : 0 }; };
                    if (count === 1) return readOne(base);
                    const arr = []; for (let i = 0; i < count; i++) arr.push(readOne(base + i * 8)); return arr;
                }
                case 11: { const arr = []; for (let i = 0; i < count; i++) arr.push(view.getFloat32(base + i * 4, little)); return count === 1 ? arr[0] : arr; }
                case 12: { const arr = []; for (let i = 0; i < count; i++) arr.push(view.getFloat64(base + i * 8, little)); return count === 1 ? arr[0] : arr; }
                default: return null;
            }
        }

        function readIFD(view, offset, tiffStart, little) {
            const numEntries = view.getUint16(offset, little);
            const tags = {};
            for (let i = 0; i < numEntries; i++) {
                const entryOffset = offset + 2 + i * 12;
                const tag = view.getUint16(entryOffset, little);
                const type = view.getUint16(entryOffset + 2, little);
                const count = view.getUint32(entryOffset + 4, little);
                const unitSize = TYPE_SIZES[type] || 0;
                const totalSize = unitSize * count;
                const valueBase = (totalSize <= 4 || totalSize === 0)
                    ? entryOffset + 8
                    : tiffStart + view.getUint32(entryOffset + 8, little);
                let value = null;
                try { value = readTypedValue(view, valueBase, type, count, little); } catch (e) { value = null; }
                tags[tag] = { type, count, value };
            }
            let nextIFDOffset = 0;
            try { nextIFDOffset = view.getUint32(offset + 2 + numEntries * 12, little); } catch (e) { }
            return { tags, nextIFDOffset };
        }

        function parseTIFF(view, tiffStart) {
            const bom = view.getUint16(tiffStart, false);
            let little;
            if (bom === 0x4949) little = true;
            else if (bom === 0x4D4D) little = false;
            else throw new Error('Invalid TIFF byte-order marker');
            if (view.getUint16(tiffStart + 2, little) !== 42) throw new Error('Invalid TIFF magic number');
            const ifd0Offset = view.getUint32(tiffStart + 4, little);
            const ifd0 = readIFD(view, tiffStart + ifd0Offset, tiffStart, little);
            let exifIfd = null, gpsIfd = null;
            if (ifd0.tags[0x8769]) { try { exifIfd = readIFD(view, tiffStart + ifd0.tags[0x8769].value, tiffStart, little); } catch (e) { } }
            if (ifd0.tags[0x8825]) { try { gpsIfd = readIFD(view, tiffStart + ifd0.tags[0x8825].value, tiffStart, little); } catch (e) { } }
            return { ifd0, exifIfd, gpsIfd, little };
        }

        const ORIENTATIONS = { 1: 'Normal', 2: 'Mirrored horizontally', 3: 'Rotated 180°', 4: 'Mirrored vertically', 5: 'Mirrored + rotated 270° CW', 6: 'Rotated 90° CW', 7: 'Mirrored + rotated 90° CW', 8: 'Rotated 270° CW (90° CCW)' };
        const EXPOSURE_PROGRAMS = { 0: 'Not defined', 1: 'Manual', 2: 'Normal program', 3: 'Aperture priority', 4: 'Shutter priority', 5: 'Creative program', 6: 'Action program', 7: 'Portrait mode', 8: 'Landscape mode' };
        const METERING_MODES = { 0: 'Unknown', 1: 'Average', 2: 'Center-weighted', 3: 'Spot', 4: 'Multi-spot', 5: 'Multi-segment', 6: 'Partial', 255: 'Other' };
        const WHITE_BALANCE_MODES = { 0: 'Auto', 1: 'Manual' };
        const LIGHT_SOURCES = { 0: 'Unknown', 1: 'Daylight', 2: 'Fluorescent', 3: 'Tungsten', 4: 'Flash', 9: 'Fine weather', 10: 'Cloudy', 11: 'Shade', 17: 'Standard light A', 18: 'Standard light B', 19: 'Standard light C', 24: 'ISO studio tungsten', 255: 'Other' };
        const RENDERING_INTENTS = { 0: 'Perceptual', 1: 'Media-Relative Colorimetric', 2: 'Saturation', 3: 'ICC-Absolute Colorimetric' };
        const PNG_COLOR_TYPES = { 0: { name: 'Grayscale', channels: 1 }, 2: { name: 'Truecolor (RGB)', channels: 3 }, 3: { name: 'Indexed / Palette', channels: 1 }, 4: { name: 'Grayscale + Alpha', channels: 2 }, 6: { name: 'Truecolor + Alpha (RGBA)', channels: 4 } };
        const BMP_COMPRESSIONS = { 0: 'None (BI_RGB)', 1: 'RLE 8-bit', 2: 'RLE 4-bit', 3: 'Bitfields', 4: 'JPEG', 5: 'PNG', 6: 'Alpha Bitfields' };

        function formatExifDate(str) {
            if (!str) return null;
            const m = str.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
            return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : str;
        }
        function formatExposureTime(r) {
            if (!r || r.value <= 0) return null;
            return r.value >= 1 ? `${r.value.toFixed(r.value % 1 === 0 ? 0 : 1)} s` : `1/${Math.round(1 / r.value)} s`;
        }
        function formatFNumber(r) { return r ? `f/${r.value.toFixed(1)}` : null; }
        function formatFocalLength(r) { return r ? `${r.value.toFixed(1)} mm` : null; }
        function formatResolution(x, y, unit) {
            if (!x || !y) return null;
            return `${Math.round(x.value)} × ${Math.round(y.value)} ${unit === 3 ? 'px/cm' : 'DPI'}`;
        }
        function formatFlash(v) {
            if (v == null) return null;
            const fired = (v & 0x1) === 1;
            let s = fired ? '⚡ Fired' : 'Did not fire';
            const mode = (v >> 3) & 0x3;
            if (mode === 1) s += ' · Compulsory firing';
            else if (mode === 2) s += ' · Compulsory suppression';
            else if (mode === 3) s += ' · Auto mode';
            return s;
        }

        function extractExifFields(t) {
            const ifd0 = (t.ifd0 && t.ifd0.tags) || {};
            const ex = (t.exifIfd && t.exifIfd.tags) || {};
            const g = (dict, tag) => (dict[tag] ? dict[tag].value : undefined);

            const iso = g(ex, 0x8827);
            return {
                make: cleanExifStr(g(ifd0, 0x010F)),
                model: cleanExifStr(g(ifd0, 0x0110)),
                software: cleanExifStr(g(ifd0, 0x0131)),
                dateTime: formatExifDate(g(ifd0, 0x0132)),
                dateTimeOriginal: formatExifDate(g(ex, 0x9003)),
                dateTimeDigitized: formatExifDate(g(ex, 0x9004)),
                orientation: ORIENTATIONS[g(ifd0, 0x0112)] || null,
                resolution: formatResolution(g(ifd0, 0x011A), g(ifd0, 0x011B), g(ifd0, 0x0128)),
                exposureTime: formatExposureTime(g(ex, 0x829A)),
                fNumber: formatFNumber(g(ex, 0x829D)),
                iso: iso != null ? (Array.isArray(iso) ? iso.join(', ') : String(iso)) : null,
                focalLength: formatFocalLength(g(ex, 0x920A)),
                focalLength35mm: g(ex, 0xA405) != null ? `${g(ex, 0xA405)} mm` : null,
                flash: formatFlash(g(ex, 0x9209)),
                exposureProgram: EXPOSURE_PROGRAMS[g(ex, 0x8822)] ?? null,
                meteringMode: METERING_MODES[g(ex, 0x9207)] ?? null,
                whiteBalance: WHITE_BALANCE_MODES[g(ex, 0xA403)] ?? null,
                lightSource: LIGHT_SOURCES[g(ex, 0x9208)] ?? null,
                lensMake: cleanExifStr(g(ex, 0xA433)),
                lensModel: cleanExifStr(g(ex, 0xA434)),
                colorSpace: (() => { const cs = g(ex, 0xA001); return cs === 1 ? 'sRGB' : cs === 65535 ? 'Uncalibrated' : cs != null ? `Unknown (${cs})` : null; })(),
                pixelDimensions: (g(ex, 0xA002) && g(ex, 0xA003)) ? `${g(ex, 0xA002)} × ${g(ex, 0xA003)}` : null
            };
        }

        function dmsToDecimal(dms, ref) {
            const dec = dms[0].value + dms[1].value / 60 + dms[2].value / 3600;
            return (ref === 'S' || ref === 'W') ? -dec : dec;
        }

        function extractGPSFields(t) {
            const gps = t.gpsIfd && t.gpsIfd.tags;
            if (!gps) return { hasGPS: false };
            const latDMS = gps[2] && gps[2].value, lonDMS = gps[4] && gps[4].value;
            if (!latDMS || !lonDMS) return { hasGPS: false };
            const latRef = gps[1] && gps[1].value, lonRef = gps[3] && gps[3].value;
            const lat = dmsToDecimal(latDMS, latRef), lon = dmsToDecimal(lonDMS, lonRef);
            const altRef = gps[5] && gps[5].value, alt = gps[6] && gps[6].value;
            const altitude = alt ? `${(altRef === 1 ? -alt.value : alt.value).toFixed(1)} m ${altRef === 1 ? '(below sea level)' : '(above sea level)'}` : null;
            const dateStamp = gps[29] && gps[29].value, timeStamp = gps[7] && gps[7].value;
            let timestamp = null;
            if (dateStamp && timeStamp) {
                const h = Math.round(timeStamp[0].value), m = Math.round(timeStamp[1].value), s = Math.round(timeStamp[2].value);
                timestamp = `${dateStamp.replace(/:/g, '-')} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`;
            }
            return {
                hasGPS: true,
                latitude: `${lat.toFixed(6)}°`, longitude: `${lon.toFixed(6)}°`,
                altitude, timestamp,
                mapsUrl: `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`
            };
        }

        function iccStr(bytes, offset, length) {
            let s = ''; for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[offset + i]);
            return s.replace(/\0+$/, '').trim();
        }
        function parseDescTag(bytes, dv, offset) {
            try {
                const typeSig = iccStr(bytes, offset, 4);
                if (typeSig === 'desc') {
                    const asciiCount = dv.getUint32(offset + 8, false);
                    let s = ''; for (let i = 0; i < asciiCount - 1; i++) s += String.fromCharCode(bytes[offset + 12 + i]);
                    return s;
                }
                if (typeSig === 'mluc') {
                    const numRecords = dv.getUint32(offset + 8, false);
                    if (numRecords > 0) {
                        const recOff = offset + 16;
                        const len = dv.getUint32(recOff + 4, false);
                        const strOff = dv.getUint32(recOff + 8, false);
                        let s = '';
                        for (let i = 0; i < len; i += 2) s += String.fromCharCode(dv.getUint16(offset + strOff + i, false));
                        return s.trim();
                    }
                }
            } catch (e) { }
            return null;
        }
        function parseICCProfile(bytes) {
            if (!bytes || bytes.length < 132) return null;
            const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const verMajor = bytes[8], verMinorRaw = bytes[9];
            const version = `${verMajor}.${(verMinorRaw >> 4) & 0x0F}.${verMinorRaw & 0x0F}`;
            const renderingIntent = dv.getUint32(64, false);
            let description = null;
            try {
                const tagCount = dv.getUint32(128, false);
                for (let i = 0; i < tagCount; i++) {
                    const entryOff = 132 + i * 12;
                    if (entryOff + 12 > bytes.length) break;
                    if (iccStr(bytes, entryOff, 4) === 'desc') {
                        description = parseDescTag(bytes, dv, dv.getUint32(entryOff + 4, false));
                        break;
                    }
                }
            } catch (e) { }
            return {
                cmmType: iccStr(bytes, 4, 4) || null,
                version,
                deviceClass: iccStr(bytes, 12, 4) || null,
                colorSpace: iccStr(bytes, 16, 4) || null,
                pcs: iccStr(bytes, 20, 4) || null,
                platform: iccStr(bytes, 40, 4) || null,
                renderingIntent: RENDERING_INTENTS[renderingIntent] || null,
                description
            };
        }

        function tagBytes(tag) {
            if (!tag || tag.value == null) return null;
            if (Array.isArray(tag.value)) {
                const out = new Uint8Array(tag.value.length);
                for (let i = 0; i < tag.value.length; i++) out[i] = typeof tag.value[i] === 'number' ? tag.value[i] & 0xFF : 0;
                return out;
            }
            if (typeof tag.value === 'number') return new Uint8Array([tag.value & 0xFF]);
            if (typeof tag.value === 'string') return new TextEncoder().encode(tag.value);
            return null;
        }

        function decodeUtf8(bytes) {
            try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (e) { return null; }
        }

        function indexOfAscii(bytes, needle) {
            const n = needle.length;
            outer: for (let i = 0; i + n <= bytes.length; i++) {
                for (let j = 0; j < n; j++) if (bytes[i + j] !== needle.charCodeAt(j)) continue outer;
                return i;
            }
            return -1;
        }

        const IPTC_DATASETS = {
            '2:5': 'Object name', '2:7': 'Edit status', '2:10': 'Urgency', '2:15': 'Category',
            '2:20': 'Supplemental category', '2:25': 'Keywords', '2:40': 'Special instructions',
            '2:55': 'Date created', '2:60': 'Time created', '2:65': 'Digital creation date',
            '2:70': 'Digital creation time', '2:80': 'Creator (by-line)', '2:85': 'Creator job title',
            '2:90': 'City', '2:92': 'Sub-location', '2:95': 'Province / State', '2:100': 'Country code',
            '2:101': 'Country', '2:103': 'Transmission reference', '2:105': 'Headline',
            '2:110': 'Credit', '2:115': 'Source', '2:116': 'Copyright notice', '2:118': 'Contact',
            '2:120': 'Caption / Abstract', '2:122': 'Writer / Editor', '2:130': 'Image type',
            '2:135': 'Image orientation'
        };

        function parseIPTC(bytes) {
            if (!bytes || bytes.length < 5) return null;
            let p = 0;
            let utf8 = false;
            const found = [];
            while (p + 5 <= bytes.length) {
                if (bytes[p] !== 0x1C) { p++; continue; }
                const record = bytes[p + 1], dataset = bytes[p + 2];
                let size = (bytes[p + 3] << 8) | bytes[p + 4];
                let headerLen = 5;
                if (size & 0x8000) {
                    const numBytes = size & 0x7FFF;
                    size = 0;
                    for (let i = 0; i < numBytes; i++) size = size * 256 + (bytes[p + 5 + i] || 0);
                    headerLen = 5 + numBytes;
                }
                const start = p + headerLen;
                if (size <= 0 || start + size > bytes.length) break;
                const value = bytes.subarray(start, start + size);
                if (record === 1 && dataset === 90) {
                    if (value[0] === 0x1B && value[1] === 0x25 && value[2] === 0x47) utf8 = true;
                } else if (record === 2) {
                    found.push({ key: record + ':' + dataset, bytes: value });
                }
                p = start + size;
            }
            if (!found.length) return null;
            const decode = (v) => {
                let s;
                if (utf8) s = decodeUtf8(v);
                else { s = ''; for (let i = 0; i < v.length; i++) s += String.fromCharCode(v[i]); }
                return s == null ? null : cleanExifStr(s);
            };
            const fields = {};
            for (const item of found) {
                const label = IPTC_DATASETS[item.key];
                if (!label) continue;
                const value = decode(item.bytes);
                if (!value) continue;
                if (label === 'Keywords' || label === 'Supplemental category') {
                    fields[label] = fields[label] ? fields[label] + ', ' + value : value;
                } else if (!fields[label]) {
                    fields[label] = value;
                }
            }
            return Object.keys(fields).length ? { charset: utf8 ? 'UTF-8' : 'Latin-1 / ISO-8859-1', fields } : null;
        }

        const PS_RESOURCES = {
            0x03E8: 'Resolution info (legacy)', 0x03ED: 'Resolution info', 0x0404: 'IPTC-NAA record',
            0x0408: 'Caption digest', 0x040A: 'Copyright flag', 0x040B: 'URL', 0x040C: 'Thumbnail resource',
            0x040F: 'ICC profile', 0x0410: 'Watermark', 0x0411: 'ICC untagged flag', 0x0416: 'Indexed color table',
            0x041A: 'Slices', 0x041E: 'URL list', 0x0421: 'Version info', 0x0422: 'EXIF data 1',
            0x0423: 'EXIF data 3', 0x0424: 'XMP metadata', 0x0425: 'Caption digest', 0x0426: 'Print scale',
            0x0428: 'Pixel aspect ratio', 0x0431: 'Print flags', 0x0432: 'Grayscale / halftoning',
            0x043A: 'Print info', 0x043B: 'Print flags info', 0x0BB6: 'Path selection state',
            0x0FA0: 'Layer info', 0x2710: 'Layer groups'
        };

        function parsePhotoshopIRB(bytes) {
            if (!bytes || bytes.length < 12) return null;
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const resources = [];
            let p = 0;
            while (p + 12 <= bytes.length) {
                if (bytesToASCII(view, p, 4) !== '8BIM') { p++; continue; }
                const id = view.getUint16(p + 4, false);
                let q = p + 6;
                const nameLen = bytes[q];
                q += 1 + nameLen;
                if ((1 + nameLen) % 2 === 1) q += 1;
                if (q + 4 > bytes.length) break;
                const size = view.getUint32(q, false);
                q += 4;
                if (q + size > bytes.length) break;
                resources.push({ id, name: PS_RESOURCES[id] || null, size, bytes: bytes.subarray(q, q + size) });
                q += size + (size % 2);
                p = q;
            }
            if (!resources.length) return null;
            const pick = (id) => {
                const found = resources.find(r => r.id === id);
                return found ? found.bytes : null;
            };
            return {
                count: resources.length,
                resources: resources.map(r => r.name || ('0x' + r.id.toString(16).padStart(4, '0').toUpperCase())),
                hasLayerInfo: resources.some(r => r.id === 0x0FA0 || r.id === 0x2710),
                iptc: pick(0x0404),
                xmp: pick(0x0424),
                icc: pick(0x040F),
                exif: pick(0x0422)
            };
        }

        const XMP_NS = {
            dc: 'purl.org/dc', xmp: 'ns.adobe.com/xap', photoshop: 'ns.adobe.com/photoshop',
            Iptc4xmpCore: 'iptc.org/std/Iptc4xmpCore', Iptc4xmpExt: 'iptc.org/std/Iptc4xmpExt',
            tiff: 'ns.adobe.com/tiff', exif: 'ns.adobe.com/exif', crs: 'ns.adobe.com/camera-raw-settings'
        };

        const XMP_FIELDS = [
            ['dc', 'creator', 'Creator'], ['dc', 'title', 'Title'], ['dc', 'description', 'Description'],
            ['dc', 'rights', 'Rights'], ['dc', 'subject', 'Keywords'], ['dc', 'format', 'Format'],
            ['dc', 'publisher', 'Publisher'], ['dc', 'contributor', 'Contributor'],
            ['xmp', 'CreatorTool', 'Creator tool'], ['xmp', 'CreateDate', 'Created'],
            ['xmp', 'ModifyDate', 'Modified'], ['xmp', 'MetadataDate', 'Metadata date'],
            ['xmp', 'Rating', 'Rating'], ['xmp', 'Label', 'Label'], ['xmp', 'Nickname', 'Nickname'],
            ['photoshop', 'Headline', 'Headline'], ['photoshop', 'Credit', 'Credit'],
            ['photoshop', 'Source', 'Source'], ['photoshop', 'City', 'City'], ['photoshop', 'State', 'State'],
            ['photoshop', 'Country', 'Country'], ['photoshop', 'Instructions', 'Instructions'],
            ['photoshop', 'AuthorsPosition', 'Creator job title'], ['photoshop', 'CaptionWriter', 'Writer / Editor'],
            ['photoshop', 'DateCreated', 'Date created'], ['photoshop', 'Category', 'Category'],
            ['photoshop', 'TransmissionReference', 'Transmission reference'],
            ['Iptc4xmpCore', 'Location', 'Location'], ['Iptc4xmpCore', 'CountryCode', 'Country code'],
            ['Iptc4xmpExt', 'PersonInImage', 'People in image'],
            ['tiff', 'Make', 'Camera make'], ['tiff', 'Model', 'Camera model'],
            ['exif', 'LensModel', 'Lens model'], ['exif', 'DateTimeOriginal', 'Date taken'],
            ['crs', 'Version', 'Camera Raw version'], ['crs', 'RawFileName', 'Raw file name']
        ];

        function xmpLocalValue(node) {
            if (!node) return null;
            const items = node.getElementsByTagNameNS('*', 'li');
            if (items.length) {
                const vals = [];
                for (let i = 0; i < items.length; i++) {
                    const t = cleanExifStr(items[i].textContent);
                    if (t) vals.push(t);
                }
                return vals.length ? vals.join(', ') : null;
            }
            return cleanExifStr(node.textContent);
        }

        function parseXMP(bytes) {
            if (!bytes || !bytes.length) return null;
            let text = decodeUtf8(bytes);
            if (!text) return null;
            const start = text.indexOf('<');
            if (start < 0) return null;
            if (start > 0) text = text.slice(start);
            let doc = null;
            try { doc = new DOMParser().parseFromString(text, 'application/xml'); } catch (e) { return null; }
            if (!doc || !doc.documentElement) return null;
            if (doc.documentElement.nodeName === 'parsererror') return null;
            if (doc.getElementsByTagName('parsererror').length) return null;
            const fields = {};
            for (const [ns, local, label] of XMP_FIELDS) {
                const all = doc.getElementsByTagNameNS('*', local);
                let node = null;
                for (let i = 0; i < all.length; i++) {
                    const uri = all[i].namespaceURI || '';
                    const wanted = XMP_NS[ns];
                    if (all[i].prefix === ns || (wanted && uri.indexOf(wanted) !== -1)) { node = all[i]; break; }
                }
                if (!node) continue;
                const value = xmpLocalValue(node);
                if (value && !fields[label]) fields[label] = value;
            }
            const packets = doc.getElementsByTagNameNS('*', 'xmpmeta').length;
            return { packetCount: packets || 1, packetSize: bytes.length, fields };
        }

        function jumbfBoxes(bytes, start, end) {
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const boxes = [];
            let p = start;
            while (p + 8 <= end) {
                let size = view.getUint32(p, false);
                const type = bytesToASCII(view, p + 4, 4);
                let header = 8;
                if (size === 1) {
                    if (p + 16 > end) break;
                    size = Number(view.getBigUint64(p + 8, false));
                    header = 16;
                } else if (size === 0) {
                    size = end - p;
                }
                if (size < header || p + size > end) break;
                boxes.push({ type, start: p + header, end: p + size });
                p += size;
            }
            return boxes;
        }

        function jumbfLabel(bytes, box) {
            if (box.end - box.start < 17) return null;
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const toggles = view.getUint8(box.start + 16);
            let p = box.start + 17;
            if (!(toggles & 0x01)) return null;
            let s = '';
            while (p < box.end && bytes[p] !== 0) { s += String.fromCharCode(bytes[p]); p++; }
            return s || null;
        }

        function cborTextAfter(bytes, needle) {
            const idx = indexOfAscii(bytes, needle);
            if (idx < 0) return null;
            const from = idx + needle.length;
            const end = Math.min(bytes.length, from + 8);
            for (let i = from; i < end; i++) {
                const b = bytes[i];
                if ((b >> 5) !== 3) continue;
                let len = b & 0x1F;
                let q = i + 1;
                if (len === 24) { len = bytes[q]; q += 1; }
                else if (len === 25) { len = (bytes[q] << 8) | bytes[q + 1]; q += 2; }
                else if (len > 25) return null;
                if (len < 2 || q + len > bytes.length) return null;
                let s = '';
                for (let j = 0; j < len; j++) s += String.fromCharCode(bytes[q + j]);
                return s;
            }
            return null;
        }

        function parseC2PA(bytes) {
            if (!bytes || bytes.length < 16) return null;
            const labels = [];
            const walk = (start, end) => {
                for (const box of jumbfBoxes(bytes, start, end)) {
                    if (box.type === 'jumb') walk(box.start, box.end);
                    else if (box.type === 'jumd') {
                        const label = jumbfLabel(bytes, box);
                        if (label) labels.push(label);
                    }
                }
            };
            walk(0, bytes.length);
            if (!labels.length || !labels.some(l => /c2pa/i.test(l))) return null;
            let claimGenerator = null;
            try { claimGenerator = cborTextAfter(bytes, 'claim_generator'); } catch (e) { }
            if (claimGenerator && !/^[\x20-\x7E]{2,}$/.test(claimGenerator)) claimGenerator = null;
            const unique = [...new Set(labels)];
            return {
                labels: unique.slice(0, 16),
                assertions: unique.filter(l => l.indexOf('c2pa.') === 0),
                hasSignature: unique.some(l => l.indexOf('c2pa.signature') === 0),
                claimGenerator,
                bytes: bytes.length
            };
        }

        function detectFormat(buffer) {
            if (buffer.byteLength < 12) return null;
            const view = new DataView(buffer);
            if (view.getUint8(0) === 0xFF && view.getUint8(1) === 0xD8 && view.getUint8(2) === 0xFF) return 'JPEG';
            if (view.getUint32(0, false) === 0x89504E47 && view.getUint32(4, false) === 0x0D0A1A0A) return 'PNG';
            if (bytesToASCII(view, 0, 4) === 'GIF8') return 'GIF';
            if (view.getUint8(0) === 0x42 && view.getUint8(1) === 0x4D) return 'BMP';
            if (bytesToASCII(view, 0, 4) === 'RIFF' && bytesToASCII(view, 8, 4) === 'WEBP') return 'WEBP';
            const b0 = view.getUint8(0), b1 = view.getUint8(1), b2 = view.getUint8(2), b3 = view.getUint8(3);
            if ((b0 === 0x49 && b1 === 0x49 && b2 === 0x2A && b3 === 0x00) || (b0 === 0x4D && b1 === 0x4D && b2 === 0x00 && b3 === 0x2A)) return 'TIFF';
            return null;
        }

        function parseJPEG(buffer) {
            const view = new DataView(buffer);
            if (view.getUint16(0, false) !== 0xFFD8) throw new Error('Missing JPEG SOI marker');
            let offset = 2;
            let exifData = null, sof = null, xmp = null, iptc = null, photoshopIRB = null;
            const iccChunks = [];
            const c2paSegments = [];
            const extXmp = [];
            const len = view.byteLength;
            while (offset < len - 1) {
                if (view.getUint8(offset) !== 0xFF) { offset++; continue; }
                let marker = view.getUint8(offset + 1);
                while (marker === 0xFF && offset + 2 < len) { offset++; marker = view.getUint8(offset + 1); }
                if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { offset += 2; continue; }
                if (marker === 0xD9 || marker === 0xDA) break;
                if (offset + 4 > len) break;
                const segLength = view.getUint16(offset + 2, false);
                if (segLength < 2) break;
                const segStart = offset + 4;

                const segDataLen = segLength - 2;
                const safeLen = Math.max(0, Math.min(segDataLen, len - segStart));
                if (marker === 0xE1 && segDataLen >= 6 && bytesToASCII(view, segStart, 6) === 'Exif\u0000\u0000') {
                    if (!exifData) exifData = { view, tiffStart: segStart + 6 };
                } else if (marker === 0xE1 && safeLen >= 29 && bytesToASCII(view, segStart, 29) === 'http://ns.adobe.com/xap/1.0/\u0000') {
                    if (!xmp) xmp = new Uint8Array(buffer, segStart + 29, safeLen - 29);
                } else if (marker === 0xE1 && safeLen >= 75 && bytesToASCII(view, segStart, 35) === 'http://ns.adobe.com/xmp/extension/\u0000') {
                    const fullLen = view.getUint32(segStart + 67, false);
                    const chunkOff = view.getUint32(segStart + 71, false);
                    extXmp.push({ fullLen, chunkOff, bytes: new Uint8Array(buffer, segStart + 75, safeLen - 75) });
                } else if (marker === 0xED && safeLen > 14 && bytesToASCII(view, segStart, 14) === 'Photoshop 3.0\u0000') {
                    if (!photoshopIRB) photoshopIRB = new Uint8Array(buffer, segStart + 14, safeLen - 14);
                } else if (marker === 0xED && safeLen > 3 && view.getUint8(segStart) === 0x1C && view.getUint8(segStart + 1) === 0x02) {
                    if (!iptc) iptc = new Uint8Array(buffer, segStart, safeLen);
                } else if (marker === 0xEB && safeLen > 8 && bytesToASCII(view, segStart, 2) === 'JP') {
                    c2paSegments.push(new Uint8Array(buffer, segStart, safeLen));
                } else if (marker === 0xE2 && bytesToASCII(view, segStart, 12).startsWith('ICC_PROFILE')) {
                    const seq = view.getUint8(segStart + 12), total = view.getUint8(segStart + 13);
                    const chunkStart = segStart + 14, chunkLen = segLength - 2 - 14;
                    if (chunkLen > 0) iccChunks.push({ seq, total, bytes: new Uint8Array(buffer, chunkStart, chunkLen) });
                } else if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
                    sof = {
                        precision: view.getUint8(segStart),
                        height: view.getUint16(segStart + 1, false),
                        width: view.getUint16(segStart + 3, false),
                        numComponents: view.getUint8(segStart + 5),
                        progressive: marker === 0xC2
                    };
                }
                offset = segStart + segLength - 2;
            }
            let icc = null;
            if (iccChunks.length) {
                iccChunks.sort((a, b) => a.seq - b.seq);
                const total = iccChunks.reduce((s, c) => s + c.bytes.length, 0);
                icc = new Uint8Array(total);
                let pos = 0; for (const c of iccChunks) { icc.set(c.bytes, pos); pos += c.bytes.length; }
            }
            if (extXmp.length) {
                try {
                    const fullLen = extXmp[0].fullLen;
                    const merged = new Uint8Array(fullLen);
                    for (const chunk of extXmp) merged.set(chunk.bytes, chunk.chunkOff);
                    xmp = merged;
                } catch (e) { }
            }
            let c2pa = null;
            if (c2paSegments.length) c2pa = joinC2PASegments(c2paSegments);
            return { exifData, icc, sof, xmp, iptc, photoshopIRB, c2pa };
        }

        function joinC2PASegments(segments) {
            const parts = [];
            for (const seg of segments) {
                if (seg.length < 8) continue;
                const view = new DataView(seg.buffer, seg.byteOffset, seg.byteLength);
                let size = view.getUint32(4, false);
                let start = 8;
                if (size === 0 || start + size > seg.length) size = seg.length - start;
                parts.push(seg.subarray(start, start + size));
            }
            if (!parts.length) return null;
            const total = parts.reduce((s, p) => s + p.length, 0);
            const out = new Uint8Array(total);
            let pos = 0;
            for (const p of parts) { out.set(p, pos); pos += p.length; }
            return out;
        }

        async function parsePNG(buffer) {
            const view = new DataView(buffer);
            const sig = [137, 80, 78, 71, 13, 10, 26, 10];
            for (let i = 0; i < 8; i++) if (view.getUint8(i) !== sig[i]) throw new Error('Invalid PNG signature');
            let offset = 8;
            let ihdr = null, phys = null, iccName = null, exifTiff = null, xmp = null, iptc = null, photoshopIRB = null;
            const c2paChunks = [];
            const textChunks = [];
            const len = view.byteLength;
            while (offset + 8 <= len) {
                const chunkLen = view.getUint32(offset, false);
                const type = bytesToASCII(view, offset + 4, 4);
                const dataStart = offset + 8;
                if (dataStart + chunkLen > len) break;
                if (type === 'IHDR') {
                    ihdr = {
                        width: view.getUint32(dataStart, false), height: view.getUint32(dataStart + 4, false),
                        bitDepth: view.getUint8(dataStart + 8), colorType: view.getUint8(dataStart + 9),
                        interlace: view.getUint8(dataStart + 12)
                    };
                } else if (type === 'pHYs') {
                    phys = { x: view.getUint32(dataStart, false), y: view.getUint32(dataStart + 4, false), unit: view.getUint8(dataStart + 8) };
                } else if (type === 'iCCP') {
                    let p = dataStart, name = '';
                    while (p < dataStart + chunkLen && view.getUint8(p) !== 0) { name += String.fromCharCode(view.getUint8(p)); p++; }
                    iccName = name;
                } else if (type === 'eXIf') {
                    try { exifTiff = parseTIFF(new DataView(buffer, dataStart, chunkLen), 0); } catch (e) { }
                } else if (type === 'caBX') {
                    c2paChunks.push(new Uint8Array(buffer, dataStart, chunkLen));
                } else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
                    textChunks.push({ type, bytes: new Uint8Array(buffer, dataStart, chunkLen) });
                } else if (type === 'IEND') {
                    break;
                }
                offset = dataStart + chunkLen + 4;
            }
            for (const chunk of textChunks) {
                const entry = await decodePNGTextChunk(chunk.type, chunk.bytes);
                if (!entry) continue;
                if (entry.keyword === 'XML:com.adobe.xmp') {
                    if (!xmp) xmp = entry.data;
                } else if (/^raw profile type/i.test(entry.keyword)) {
                    const raw = decodeRawProfile(entry.text);
                    if (!raw) continue;
                    if (/iptc/i.test(entry.keyword)) { if (!iptc) iptc = raw; }
                    else if (/8bim|photoshop/i.test(entry.keyword)) { if (!photoshopIRB) photoshopIRB = raw; }
                }
            }
            let c2pa = null;
            if (c2paChunks.length) {
                const total = c2paChunks.reduce((s, c) => s + c.length, 0);
                c2pa = new Uint8Array(total);
                let pos = 0;
                for (const c of c2paChunks) { c2pa.set(c, pos); pos += c.length; }
            }
            return { ihdr, phys, iccName, exifTiff, xmp, iptc, photoshopIRB, c2pa };
        }

        async function inflateBytes(bytes) {
            if (typeof DecompressionStream === 'undefined') return null;
            try {
                const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
                const buf = await new Response(stream).arrayBuffer();
                return new Uint8Array(buf);
            } catch (e) { return null; }
        }

        async function decodePNGTextChunk(type, bytes) {
            let p = 0;
            let keyword = '';
            while (p < bytes.length && bytes[p] !== 0) { keyword += String.fromCharCode(bytes[p]); p++; }
            p++;
            if (type === 'tEXt') {
                let text = '';
                for (let i = p; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
                return { keyword, text, data: new TextEncoder().encode(text) };
            }
            if (type === 'zTXt') {
                const method = bytes[p]; p++;
                if (method !== 0) return null;
                const inflated = await inflateBytes(bytes.subarray(p));
                if (!inflated) return null;
                return { keyword, text: decodeUtf8(inflated) || '', data: inflated };
            }
            if (type === 'iTXt') {
                const compressed = bytes[p] === 1; p++;
                const method = bytes[p]; p++;
                while (p < bytes.length && bytes[p] !== 0) p++;
                p++;
                while (p < bytes.length && bytes[p] !== 0) p++;
                p++;
                let data = bytes.subarray(p);
                if (compressed) {
                    if (method !== 0) return null;
                    const inflated = await inflateBytes(data);
                    if (!inflated) return null;
                    data = inflated;
                }
                return { keyword, text: decodeUtf8(data) || '', data };
            }
            return null;
        }

        function decodeRawProfile(text) {
            if (!text) return null;
            const lines = text.split(/\r?\n/).map(l => l.trim());
            const hexLines = [];
            let seenLength = false;
            for (const line of lines) {
                if (!line) continue;
                if (!seenLength) { seenLength = /^\d+$/.test(line); continue; }
                hexLines.push(line.replace(/[^0-9a-fA-F]/g, ''));
            }
            const hex = hexLines.join('');
            if (hex.length < 16 || hex.length % 2 !== 0) return null;
            const out = new Uint8Array(hex.length / 2);
            for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
            return out;
        }

        function parseGIF(buffer) {
            const view = new DataView(buffer);
            const header = bytesToASCII(view, 0, 6);
            if (header !== 'GIF87a' && header !== 'GIF89a') throw new Error('Invalid GIF header');
            const width = view.getUint16(6, true), height = view.getUint16(8, true);
            const packed = view.getUint8(10);
            const gctFlag = (packed >> 7) & 1;
            const colorResolution = ((packed >> 4) & 0x07) + 1;
            const gctSize = gctFlag ? Math.pow(2, (packed & 0x07) + 1) : 0;
            return { version: header, width, height, colorResolution, gctFlag: !!gctFlag, gctSize };
        }

        function parseBMP(buffer) {
            const view = new DataView(buffer);
            if (view.getUint8(0) !== 0x42 || view.getUint8(1) !== 0x4D) throw new Error('Invalid BMP header');
            const width = view.getInt32(18, true);
            const heightRaw = view.getInt32(22, true);
            const bitCount = view.getUint16(28, true);
            const compression = view.getUint32(30, true);
            const xPelsPerMeter = view.getInt32(38, true), yPelsPerMeter = view.getInt32(42, true);
            return {
                width, height: Math.abs(heightRaw), topDown: heightRaw < 0, bitCount, compression,
                xDPI: xPelsPerMeter > 0 ? Math.round(xPelsPerMeter * 0.0254) : null,
                yDPI: yPelsPerMeter > 0 ? Math.round(yPelsPerMeter * 0.0254) : null
            };
        }

        function parseWebP(buffer) {
            const view = new DataView(buffer);
            if (bytesToASCII(view, 0, 4) !== 'RIFF' || bytesToASCII(view, 8, 4) !== 'WEBP') throw new Error('Invalid WebP header');
            let offset = 12;
            const len = view.byteLength;
            let width = null, height = null, format = null, hasAlpha = false, hasAnim = false, exifTiff = null, icc = null, xmp = null, c2pa = null;
            while (offset + 8 <= len) {
                const fourcc = bytesToASCII(view, offset, 4);
                const chunkSize = view.getUint32(offset + 4, true);
                const dataStart = offset + 8;
                if (dataStart + chunkSize > len) break;
                if (fourcc === 'VP8 ') {
                    format = 'Lossy (VP8)';
                    if (view.getUint8(dataStart + 3) === 0x9d && view.getUint8(dataStart + 4) === 0x01 && view.getUint8(dataStart + 5) === 0x2a) {
                        width = view.getUint16(dataStart + 6, true) & 0x3FFF;
                        height = view.getUint16(dataStart + 8, true) & 0x3FFF;
                    }
                } else if (fourcc === 'VP8L') {
                    format = 'Lossless (VP8L)';
                    if (view.getUint8(dataStart) === 0x2F) {
                        const bits = view.getUint32(dataStart + 1, true);
                        width = (bits & 0x3FFF) + 1;
                        height = ((bits >>> 14) & 0x3FFF) + 1;
                        hasAlpha = !!((bits >>> 28) & 1);
                    }
                } else if (fourcc === 'VP8X') {
                    const flags = view.getUint8(dataStart);
                    hasAlpha = !!((flags >> 4) & 1);
                    hasAnim = !!((flags >> 1) & 1);
                    width = (view.getUint8(dataStart + 4) | (view.getUint8(dataStart + 5) << 8) | (view.getUint8(dataStart + 6) << 16)) + 1;
                    height = (view.getUint8(dataStart + 7) | (view.getUint8(dataStart + 8) << 8) | (view.getUint8(dataStart + 9) << 16)) + 1;
                    format = 'Extended (VP8X)' + (hasAnim ? ' · Animated' : '');
                } else if (fourcc === 'ICCP') {
                    try { icc = new Uint8Array(buffer, dataStart, chunkSize); } catch (e) { }
                } else if (fourcc === 'XMP ') {
                    try { xmp = new Uint8Array(buffer, dataStart, chunkSize); } catch (e) { }
                } else if (fourcc === 'C2PA') {
                    try { c2pa = new Uint8Array(buffer, dataStart, chunkSize); } catch (e) { }
                } else if (fourcc === 'EXIF') {
                    try {
                        let exifOffset = dataStart;
                        if (bytesToASCII(view, dataStart, 6) === 'Exif\u0000\u0000') exifOffset = dataStart + 6;
                        exifTiff = parseTIFF(new DataView(buffer, exifOffset, dataStart + chunkSize - exifOffset), 0);
                    } catch (e) { }
                }
                offset = dataStart + chunkSize + (chunkSize % 2);
            }
            return { width, height, format, hasAlpha, hasAnim, exifTiff, icc, xmp, c2pa };
        }

        function parseTIFFFile(buffer) {
            const view = new DataView(buffer);
            const result = parseTIFF(view, 0);
            const width = result.ifd0.tags[256] ? result.ifd0.tags[256].value : null;
            const height = result.ifd0.tags[257] ? result.ifd0.tags[257].value : null;
            const tags = result.ifd0.tags;
            return Object.assign({
                width, height,
                iptc: tagBytes(tags[0x83BB]),
                xmp: tagBytes(tags[0x02BC]),
                photoshopIRB: tagBytes(tags[0x8649]),
                icc: tagBytes(tags[0x8773])
            }, result);
        }

        const MIME_FALLBACK = { JPEG: 'image/jpeg', PNG: 'image/png', GIF: 'image/gif', BMP: 'image/bmp', WEBP: 'image/webp', TIFF: 'image/tiff' };

        function recomputeDerived(meta) {
            const { width, height } = meta.image;
            if (width && height) {
                meta.image.aspectRatio = computeAspectRatio(width, height);
                meta.image.megapixels = `${((width * height) / 1e6).toFixed(2)} MP`;
            }
        }

        async function buildMetadata(file, buffer, format) {
            const meta = {
                fileInfo: {
                    name: file.name, size: file.size, sizeFormatted: formatBytes(file.size),
                    type: file.type || MIME_FALLBACK[format] || null,
                    lastModified: file.lastModified,
                    lastModifiedFormatted: file.lastModified ? new Date(file.lastModified).toLocaleString() : null
                },
                format,
                image: { width: null, height: null, aspectRatio: null, megapixels: null },
                exif: null, gps: null, icc: null,
                iptc: null, xmp: null, photoshop: null, c2pa: null, sources: null,
                formatSpecific: { colorDepth: null, dpi: null, variant: null }
            };

            let parsed = null;
            try {
                if (format === 'JPEG') parsed = parseJPEG(buffer);
                else if (format === 'PNG') parsed = await parsePNG(buffer);
                else if (format === 'GIF') parsed = parseGIF(buffer);
                else if (format === 'BMP') parsed = parseBMP(buffer);
                else if (format === 'WEBP') parsed = parseWebP(buffer);
                else if (format === 'TIFF') parsed = parseTIFFFile(buffer);
            } catch (e) { console.warn('Binary parse failed:', e); }

            let tiffResult = null, iccBytes = null, iccName = null;
            let xmpBytes = null, iptcBytes = null, psBytes = null, c2paBytes = null;

            if (format === 'JPEG' && parsed) {
                if (parsed.sof) {
                    meta.image.width = parsed.sof.width; meta.image.height = parsed.sof.height;
                    meta.formatSpecific.colorDepth = `${parsed.sof.precision * parsed.sof.numComponents}-bit (${parsed.sof.precision}-bit × ${parsed.sof.numComponents} ch) · ${parsed.sof.progressive ? 'Progressive' : 'Baseline'}`;
                }
                if (parsed.exifData) { try { tiffResult = parseTIFF(parsed.exifData.view, parsed.exifData.tiffStart); } catch (e) { } }
                if (parsed.icc) iccBytes = parsed.icc;
                if (parsed.xmp) xmpBytes = parsed.xmp;
                if (parsed.iptc) iptcBytes = parsed.iptc;
                if (parsed.photoshopIRB) psBytes = parsed.photoshopIRB;
                if (parsed.c2pa) c2paBytes = parsed.c2pa;
            } else if (format === 'PNG' && parsed) {
                if (parsed.ihdr) {
                    meta.image.width = parsed.ihdr.width; meta.image.height = parsed.ihdr.height;
                    const ct = PNG_COLOR_TYPES[parsed.ihdr.colorType];
                    meta.formatSpecific.colorDepth = ct ? `${parsed.ihdr.bitDepth}-bit × ${ct.channels} ch (${ct.name})` : `${parsed.ihdr.bitDepth}-bit`;
                }
                if (parsed.phys && parsed.phys.unit === 1) {
                    meta.formatSpecific.dpi = `${Math.round(parsed.phys.x * 0.0254)} × ${Math.round(parsed.phys.y * 0.0254)} DPI`;
                }
                if (parsed.exifTiff) tiffResult = parsed.exifTiff;
                if (parsed.iccName) iccName = parsed.iccName;
                if (parsed.xmp) xmpBytes = parsed.xmp;
                if (parsed.iptc) iptcBytes = parsed.iptc;
                if (parsed.photoshopIRB) psBytes = parsed.photoshopIRB;
                if (parsed.c2pa) c2paBytes = parsed.c2pa;
            } else if (format === 'GIF' && parsed) {
                meta.image.width = parsed.width; meta.image.height = parsed.height;
                meta.formatSpecific.colorDepth = `${parsed.colorResolution}-bit/channel · GCT: ${parsed.gctFlag ? parsed.gctSize + ' colors' : 'None'}`;
            } else if (format === 'BMP' && parsed) {
                meta.image.width = parsed.width; meta.image.height = parsed.height;
                meta.formatSpecific.colorDepth = `${parsed.bitCount}-bit (${BMP_COMPRESSIONS[parsed.compression] || 'Unknown compression'})`;
                if (parsed.xDPI && parsed.yDPI) meta.formatSpecific.dpi = `${parsed.xDPI} × ${parsed.yDPI} DPI`;
            } else if (format === 'WEBP' && parsed) {
                meta.image.width = parsed.width; meta.image.height = parsed.height;
                meta.formatSpecific.colorDepth = parsed.hasAlpha ? '32-bit (24-bit RGB + 8-bit Alpha)' : '24-bit RGB';
                meta.formatSpecific.variant = parsed.format;
                if (parsed.exifTiff) tiffResult = parsed.exifTiff;
                if (parsed.icc) iccBytes = parsed.icc;
                if (parsed.xmp) xmpBytes = parsed.xmp;
                if (parsed.c2pa) c2paBytes = parsed.c2pa;
            } else if (format === 'TIFF' && parsed) {
                meta.image.width = parsed.width; meta.image.height = parsed.height;
                const bps = parsed.ifd0.tags[258] ? parsed.ifd0.tags[258].value : null;
                const spp = parsed.ifd0.tags[277] ? parsed.ifd0.tags[277].value : 1;
                if (bps != null) meta.formatSpecific.colorDepth = `${Array.isArray(bps) ? bps[0] : bps}-bit × ${spp} ch`;
                if (parsed.xmp) xmpBytes = parsed.xmp;
                if (parsed.iptc) iptcBytes = parsed.iptc;
                if (parsed.photoshopIRB) psBytes = parsed.photoshopIRB;
                if (parsed.icc) iccBytes = parsed.icc;
                tiffResult = parsed;
            }

            if (tiffResult) {
                try { meta.exif = extractExifFields(tiffResult); } catch (e) { console.warn(e); }
                try { meta.gps = extractGPSFields(tiffResult); } catch (e) { console.warn(e); }
                if (meta.exif && meta.exif.resolution && !meta.formatSpecific.dpi) meta.formatSpecific.dpi = meta.exif.resolution;
            }

            if (iccBytes) { try { meta.icc = parseICCProfile(iccBytes); } catch (e) { console.warn(e); } }
            if (iccName) {
                if (meta.icc) meta.icc.description = meta.icc.description || iccName;
                else meta.icc = { description: iccName };
            }

            if (psBytes) {
                try {
                    const ps = parsePhotoshopIRB(psBytes);
                    if (ps) {
                        meta.photoshop = ps;
                        if (!iptcBytes && ps.iptc) iptcBytes = ps.iptc;
                        if (!xmpBytes && ps.xmp) xmpBytes = ps.xmp;
                        if (!iccBytes && ps.icc) { try { meta.icc = parseICCProfile(ps.icc); } catch (e) { } }
                    }
                } catch (e) { console.warn(e); }
            }

            if (iptcBytes) { try { meta.iptc = parseIPTC(iptcBytes); } catch (e) { console.warn(e); } }
            if (xmpBytes) { try { meta.xmp = parseXMP(xmpBytes); } catch (e) { console.warn(e); } }
            if (c2paBytes) { try { meta.c2pa = parseC2PA(c2paBytes); } catch (e) { console.warn(e); } }

            meta.sources = collectSources(meta);

            recomputeDerived(meta);
            return meta;
        }

        function collectSources(meta) {
            const exifKeys = meta.exif ? Object.keys(meta.exif).filter(k => meta.exif[k] != null).length : 0;
            return [
                {
                    key: 'Core file / raster metadata',
                    present: !!(meta.image.width || meta.formatSpecific.colorDepth || meta.formatSpecific.dpi),
                    detail: [
                        meta.image.width && meta.image.height ? `${meta.image.width} × ${meta.image.height} px` : null,
                        meta.formatSpecific.colorDepth,
                        meta.formatSpecific.dpi
                    ].filter(Boolean).join(' · ')
                },
                {
                    key: 'EXIF (Exchangeable Image File Format)',
                    present: exifKeys > 0,
                    detail: exifKeys ? `${exifKeys} fields` : null
                },
                {
                    key: 'GPS geolocation block',
                    present: !!(meta.gps && meta.gps.hasGPS),
                    detail: meta.gps && meta.gps.hasGPS ? `${meta.gps.latitude}, ${meta.gps.longitude}` : null
                },
                {
                    key: 'IPTC (International Press Telecommunications Council)',
                    present: !!meta.iptc,
                    detail: meta.iptc ? `${Object.keys(meta.iptc.fields).length} fields · ${meta.iptc.charset}` : null
                },
                {
                    key: 'XMP (Extensible Metadata Platform)',
                    present: !!meta.xmp,
                    detail: meta.xmp ? `${Object.keys(meta.xmp.fields).length} fields · ${meta.xmp.packetSize} bytes` : null
                },
                {
                    key: 'ICC Profiles (International Color Consortium)',
                    present: !!meta.icc,
                    detail: meta.icc ? (meta.icc.description || meta.icc.colorSpace || null) : null
                },
                {
                    key: '8BIM / Photoshop Resource Blocks',
                    present: !!meta.photoshop,
                    detail: meta.photoshop ? `${meta.photoshop.count} resources` : null
                },
                {
                    key: 'C2PA (Coalition for Content Provenance and Authenticity)',
                    present: !!meta.c2pa,
                    detail: meta.c2pa ? `${meta.c2pa.labels.length} labels · ${meta.c2pa.hasSignature ? 'signed' : 'unsigned'}` : null
                }
            ];
        }

        function analyzeColors(img) {
            const maxDim = 200;
            const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(1, Math.round(img.naturalWidth * scale));
            const h = Math.max(1, Math.round(img.naturalHeight * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, w, h);
            const data = ctx.getImageData(0, 0, w, h).data;
            const rHist = new Array(256).fill(0), gHist = new Array(256).fill(0), bHist = new Array(256).fill(0);
            const buckets = new Map();
            let counted = 0;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                if (a < 10) continue;
                rHist[r]++; gHist[g]++; bHist[b]++; counted++;
                const key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
                buckets.set(key, (buckets.get(key) || 0) + 1);
            }
            const dominantColors = [...buckets.entries()]
                .sort((a, b) => b[1] - a[1]).slice(0, 6)
                .map(([key, count]) => {
                    const [rq, gq, bq] = key.split(',').map(Number);
                    const r = (rq << 4) + 8, g = (gq << 4) + 8, b = (bq << 4) + 8;
                    const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
                    return { hex, pct: `${((count / Math.max(counted, 1)) * 100).toFixed(1)}%` };
                });
            return { histogram: { r: rHist, g: gHist, b: bHist }, dominantColors };
        }

        function drawHistogram(canvas, histogram) {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.max(1, rect.width * dpr);
            canvas.height = Math.max(1, 90 * dpr);
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const w = rect.width, h = 90;
            ctx.clearRect(0, 0, w, h);
            const max = Math.max(1, ...histogram.r, ...histogram.g, ...histogram.b);
            ctx.globalCompositeOperation = 'lighter';
            [['r', getComputedStyle(document.documentElement).getPropertyValue('--hist-r').trim() || '#ff5470'],
            ['g', getComputedStyle(document.documentElement).getPropertyValue('--hist-g').trim() || '#39d98a'],
            ['b', getComputedStyle(document.documentElement).getPropertyValue('--hist-b').trim() || '#4cc9f0']
            ].forEach(([key, color]) => {
                const d = histogram[key];
                ctx.beginPath(); ctx.moveTo(0, h);
                for (let i = 0; i < 256; i++) { ctx.lineTo((i / 255) * w, h - (d[i] / max) * h); }
                ctx.lineTo(w, h); ctx.closePath();
                ctx.globalAlpha = 0.55; ctx.fillStyle = color; ctx.fill();
            });
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }

        function buildRow(icon, label, value, opts) {
            opts = opts || {};
            const row = document.createElement('div');
            row.className = 'meta-row';

            const left = document.createElement('div');
            left.className = 'meta-row-label';
            left.innerHTML = `<span class="row-icon">${icon}</span>${label}`;

            const right = document.createElement('div');
            right.className = 'meta-row-value';

            const isEmpty = value === undefined || value === null || value === '';
            const displayValue = isEmpty ? 'Not available' : value;

            let valEl;
            if (opts.href && !isEmpty) {
                valEl = document.createElement('a');
                valEl.href = opts.href; valEl.target = '_blank'; valEl.rel = 'noopener noreferrer';
                valEl.textContent = opts.linkText || displayValue;
            } else {
                valEl = document.createElement('span');
                valEl.textContent = displayValue;
            }
            valEl.className = 'val' + (isEmpty ? ' value-empty' : '');
            right.appendChild(valEl);

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.type = 'button';
            copyBtn.title = 'Copy value';
            copyBtn.setAttribute('aria-label', `Copy ${label}`);
            copyBtn.textContent = '📋';
            copyBtn.addEventListener('click', () => copyToClipboard(String(displayValue), copyBtn));
            right.appendChild(copyBtn);

            row.appendChild(left); row.appendChild(right);
            return row;
        }

        function buildCard(tag, icon, title, rows) {
            const card = document.createElement('div');
            card.className = 'meta-card';
            const header = document.createElement('div');
            header.className = 'meta-card-header';
            header.innerHTML = `<span class="card-icon">${icon}</span><h3>${title}</h3><span class="card-tag">${tag}</span>`;
            card.appendChild(header);
            rows.forEach(r => card.appendChild(buildRow(r.icon, r.label, r.value, r.opts)));
            return card;
        }

        function buildSourcesCard(sources) {
            const rows = sources.map(s => ({
                icon: s.present ? '✅' : '⚪',
                label: s.key,
                value: s.present ? (s.detail ? `Present · ${s.detail}` : 'Present') : 'Not present'
            }));
            return buildCard('0x06', '🧾', 'Metadata categories', rows);
        }

        function buildColorCard(colorAnalysis) {
            const card = document.createElement('div');
            card.className = 'meta-card';
            card.style.gridColumn = '1 / -1';
            const header = document.createElement('div');
            header.className = 'meta-card-header';
            header.innerHTML = `<span class="card-icon">🎨</span><h3>Color analysis</h3><span class="card-tag">0x07</span>`;
            card.appendChild(header);

            const swatchRow = document.createElement('div');
            swatchRow.className = 'swatch-row';
            colorAnalysis.dominantColors.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'swatch'; btn.type = 'button';
                btn.title = `Copy ${c.hex}`;
                btn.innerHTML = `<span class="swatch-color" style="background:${c.hex}"></span><span class="swatch-label">${c.hex}</span><span class="swatch-label">${c.pct}</span>`;
                btn.addEventListener('click', () => copyToClipboard(c.hex, btn));
                swatchRow.appendChild(btn);
            });
            card.appendChild(swatchRow);

            const histWrap = document.createElement('div');
            histWrap.className = 'hist-wrap';
            const canvas = document.createElement('canvas');
            histWrap.appendChild(canvas);
            const legend = document.createElement('div');
            legend.className = 'hist-legend';
            legend.innerHTML = `<span><span class="hist-dot" style="background:var(--hist-r)"></span>Red</span><span><span class="hist-dot" style="background:var(--hist-g)"></span>Green</span><span><span class="hist-dot" style="background:var(--hist-b)"></span>Blue</span>`;
            histWrap.appendChild(legend);
            card.appendChild(histWrap);

            requestAnimationFrame(() => drawHistogram(canvas, colorAnalysis.histogram));
            return card;
        }

        function renderAllCards(meta) {
            const grid = document.getElementById('cardsGrid');
            grid.innerHTML = '';

            grid.appendChild(buildCard('0x01', '📁', 'File info', [
                { icon: '📁', label: 'File name', value: meta.fileInfo.name },
                { icon: '📦', label: 'File size', value: meta.fileInfo.sizeFormatted },
                { icon: '🖼️', label: 'MIME type', value: meta.fileInfo.type },
                { icon: '🔖', label: 'Detected format', value: meta.format },
                { icon: '📅', label: 'Last modified', value: meta.fileInfo.lastModifiedFormatted }
            ]));

            grid.appendChild(buildCard('0x02', '📐', 'Image properties', [
                { icon: '📐', label: 'Width', value: meta.image.width ? `${meta.image.width} px` : null },
                { icon: '📏', label: 'Height', value: meta.image.height ? `${meta.image.height} px` : null },
                { icon: '⚖️', label: 'Aspect ratio', value: meta.image.aspectRatio },
                { icon: '🔲', label: 'Megapixels', value: meta.image.megapixels },
                { icon: '🎨', label: 'Color depth', value: meta.formatSpecific.colorDepth },
                { icon: '🧭', label: 'Orientation', value: meta.exif && meta.exif.orientation },
                { icon: '🔍', label: 'DPI / resolution', value: meta.formatSpecific.dpi }
            ]));

            grid.appendChild(buildCard('0x03', '📷', 'Camera / EXIF', [
                { icon: '🏭', label: 'Make', value: meta.exif && meta.exif.make },
                { icon: '📷', label: 'Model', value: meta.exif && meta.exif.model },
                { icon: '🔭', label: 'Lens make', value: meta.exif && meta.exif.lensMake },
                { icon: '🔬', label: 'Lens model', value: meta.exif && meta.exif.lensModel },
                { icon: '🌡️', label: 'ISO', value: meta.exif && meta.exif.iso },
                { icon: '⏱️', label: 'Shutter speed', value: meta.exif && meta.exif.exposureTime },
                { icon: '🔘', label: 'Aperture', value: meta.exif && meta.exif.fNumber },
                { icon: '🔎', label: 'Focal length', value: meta.exif && meta.exif.focalLength },
                { icon: '🔎', label: 'Focal length (35mm eq.)', value: meta.exif && meta.exif.focalLength35mm },
                { icon: '⚡', label: 'Flash', value: meta.exif && meta.exif.flash },
                { icon: '🎛️', label: 'Exposure program', value: meta.exif && meta.exif.exposureProgram },
                { icon: '📊', label: 'Metering mode', value: meta.exif && meta.exif.meteringMode },
                { icon: '⚪', label: 'White balance', value: meta.exif && meta.exif.whiteBalance },
                { icon: '🌈', label: 'Color space', value: meta.exif && meta.exif.colorSpace },
                { icon: '💾', label: 'Software', value: meta.exif && meta.exif.software },
                { icon: '🗓️', label: 'Date taken', value: meta.exif && meta.exif.dateTimeOriginal },
                { icon: '🗓️', label: 'Date (file)', value: meta.exif && meta.exif.dateTime }
            ]));

            const gps = meta.gps;
            grid.appendChild(buildCard('0x04', '🌍', 'GPS location', [
                { icon: '🌍', label: 'Latitude', value: gps && gps.hasGPS ? gps.latitude : null },
                { icon: '🌍', label: 'Longitude', value: gps && gps.hasGPS ? gps.longitude : null },
                { icon: '⛰️', label: 'Altitude', value: gps && gps.altitude },
                { icon: '🕐', label: 'Timestamp (UTC)', value: gps && gps.timestamp },
                { icon: '🔗', label: 'Map link', value: gps && gps.hasGPS ? 'Open in Google Maps ↗' : null, opts: gps && gps.hasGPS ? { href: gps.mapsUrl, linkText: 'Open in Google Maps ↗' } : {} }
            ]));

            grid.appendChild(buildCard('0x05', '🖌️', 'ICC color profile', [
                { icon: '🖌️', label: 'Description', value: meta.icc && meta.icc.description },
                { icon: '🌈', label: 'Color space', value: meta.icc && meta.icc.colorSpace },
                { icon: '🏷️', label: 'Device class', value: meta.icc && meta.icc.deviceClass },
                { icon: '🎯', label: 'Rendering intent', value: meta.icc && meta.icc.renderingIntent },
                { icon: '⚙️', label: 'CMM type', value: meta.icc && meta.icc.cmmType },
                { icon: '🔢', label: 'Version', value: meta.icc && meta.icc.version }
            ]));

            if (meta.sources) grid.appendChild(buildSourcesCard(meta.sources));

            if (meta.iptc) {
                const f = meta.iptc.fields;
                grid.appendChild(buildCard('0x08', '📰', 'IPTC descriptive metadata', [
                    { icon: '🏷️', label: 'Object name', value: f['Object name'] },
                    { icon: '📰', label: 'Headline', value: f['Headline'] },
                    { icon: '📝', label: 'Caption / Abstract', value: f['Caption / Abstract'] },
                    { icon: '✍️', label: 'Creator (by-line)', value: f['Creator (by-line)'] },
                    { icon: '💼', label: 'Creator job title', value: f['Creator job title'] },
                    { icon: '🔑', label: 'Keywords', value: f['Keywords'] },
                    { icon: '©️', label: 'Copyright notice', value: f['Copyright notice'] },
                    { icon: '🏢', label: 'Credit', value: f['Credit'] },
                    { icon: '📡', label: 'Source', value: f['Source'] },
                    { icon: '🏙️', label: 'City', value: f['City'] },
                    { icon: '📍', label: 'Sub-location', value: f['Sub-location'] },
                    { icon: '🗺️', label: 'Province / State', value: f['Province / State'] },
                    { icon: '🌐', label: 'Country', value: f['Country'] },
                    { icon: '🗓️', label: 'Date created', value: f['Date created'] },
                    { icon: '🕐', label: 'Time created', value: f['Time created'] },
                    { icon: '📋', label: 'Special instructions', value: f['Special instructions'] },
                    { icon: '🔤', label: 'Character set', value: meta.iptc.charset }
                ]));
            }

            if (meta.xmp) {
                const f = meta.xmp.fields;
                grid.appendChild(buildCard('0x09', '🧬', 'XMP (Adobe XML) metadata', [
                    { icon: '🎬', label: 'Creator', value: f['Creator'] },
                    { icon: '🏷️', label: 'Title', value: f['Title'] },
                    { icon: '📝', label: 'Description', value: f['Description'] },
                    { icon: '©️', label: 'Rights', value: f['Rights'] },
                    { icon: '🔑', label: 'Keywords', value: f['Keywords'] },
                    { icon: '⭐', label: 'Rating', value: f['Rating'] },
                    { icon: '🏷️', label: 'Color label', value: f['Label'] },
                    { icon: '🛠️', label: 'Creator tool', value: f['Creator tool'] },
                    { icon: '🖌️', label: 'Camera Raw version', value: f['Camera Raw version'] },
                    { icon: '🗓️', label: 'Created', value: f['Created'] },
                    { icon: '🗓️', label: 'Modified', value: f['Modified'] },
                    { icon: '🗓️', label: 'Metadata date', value: f['Metadata date'] },
                    { icon: '📰', label: 'Headline', value: f['Headline'] },
                    { icon: '🏢', label: 'Credit', value: f['Credit'] },
                    { icon: '📡', label: 'Source', value: f['Source'] },
                    { icon: '🏙️', label: 'City', value: f['City'] },
                    { icon: '🌐', label: 'Country', value: f['Country'] },
                    { icon: '📍', label: 'Location', value: f['Location'] },
                    { icon: '👤', label: 'People in image', value: f['People in image'] },
                    { icon: '📄', label: 'Packet size', value: `${meta.xmp.packetSize} bytes` }
                ]));
            }

            if (meta.photoshop) {
                grid.appendChild(buildCard('0x0A', '🅿️', 'Photoshop 8BIM resource blocks', [
                    { icon: '🧩', label: 'Resource blocks', value: String(meta.photoshop.count) },
                    { icon: '📚', label: 'Layer info', value: meta.photoshop.hasLayerInfo ? 'Present' : 'Not present' },
                    { icon: '🗂️', label: 'Block inventory', value: meta.photoshop.resources.join(', ') }
                ]));
            }

            if (meta.c2pa) {
                grid.appendChild(buildCard('0x0B', '🔐', 'C2PA content provenance', [
                    { icon: '📦', label: 'Manifest present', value: 'Yes' },
                    { icon: '✍️', label: 'Signature', value: meta.c2pa.hasSignature ? 'Signed claim found' : 'Not found' },
                    { icon: '🧾', label: 'Claim generator', value: meta.c2pa.claimGenerator },
                    { icon: '📚', label: 'Assertions', value: meta.c2pa.assertions.join(', ') },
                    { icon: '🏷️', label: 'JUMBF labels', value: meta.c2pa.labels.join(', ') },
                    { icon: '📏', label: 'Manifest size', value: `${meta.c2pa.bytes} bytes` }
                ]));
            }

            if (meta.colorAnalysis) grid.appendChild(buildColorCard(meta.colorAnalysis));
        }

        async function copyToClipboard(text, btn) {
            if (text == null || text === '') text = 'Not available';
            let ok = false;
            try {
                if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
            } catch (e) { }
            if (!ok) {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                    document.body.appendChild(ta); ta.focus(); ta.select();
                    ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch (e) { }
            }
            if (btn) {
                const original = btn.textContent;
                btn.textContent = ok ? '✅' : '❌';
                btn.classList.add(ok ? 'copy-success' : 'copy-fail');
                setTimeout(() => { btn.textContent = original; btn.classList.remove('copy-success', 'copy-fail'); }, 1100);
            }
        }

        function buildTextReport(meta) {
            const lines = [];
            lines.push('='.repeat(50), 'PIXELPEEK — IMAGE METADATA REPORT', 'Generated: ' + new Date().toLocaleString(), '='.repeat(50), '');
            const section = (title, rows) => {
                lines.push(`--- ${title} ---`);
                rows.forEach(([k, v]) => lines.push(`${k}: ${v ?? 'Not available'}`));
                lines.push('');
            };
            section('FILE INFO', [
                ['File name', meta.fileInfo.name], ['File size', meta.fileInfo.sizeFormatted],
                ['MIME type', meta.fileInfo.type], ['Detected format', meta.format],
                ['Last modified', meta.fileInfo.lastModifiedFormatted]
            ]);
            section('IMAGE PROPERTIES', [
                ['Width', meta.image.width ? meta.image.width + ' px' : null],
                ['Height', meta.image.height ? meta.image.height + ' px' : null],
                ['Aspect ratio', meta.image.aspectRatio], ['Megapixels', meta.image.megapixels],
                ['Color depth', meta.formatSpecific.colorDepth],
                ['Orientation', meta.exif && meta.exif.orientation],
                ['DPI / resolution', meta.formatSpecific.dpi]
            ]);
            section('CAMERA / EXIF', [
                ['Make', meta.exif && meta.exif.make], ['Model', meta.exif && meta.exif.model],
                ['Lens make', meta.exif && meta.exif.lensMake], ['Lens model', meta.exif && meta.exif.lensModel],
                ['ISO', meta.exif && meta.exif.iso], ['Shutter speed', meta.exif && meta.exif.exposureTime],
                ['Aperture', meta.exif && meta.exif.fNumber], ['Focal length', meta.exif && meta.exif.focalLength],
                ['Focal length (35mm eq.)', meta.exif && meta.exif.focalLength35mm],
                ['Flash', meta.exif && meta.exif.flash], ['Exposure program', meta.exif && meta.exif.exposureProgram],
                ['Metering mode', meta.exif && meta.exif.meteringMode], ['White balance', meta.exif && meta.exif.whiteBalance],
                ['Color space', meta.exif && meta.exif.colorSpace], ['Software', meta.exif && meta.exif.software],
                ['Date taken', meta.exif && meta.exif.dateTimeOriginal], ['Date (file)', meta.exif && meta.exif.dateTime]
            ]);
            section('GPS LOCATION', [
                ['Latitude', meta.gps && meta.gps.hasGPS ? meta.gps.latitude : null],
                ['Longitude', meta.gps && meta.gps.hasGPS ? meta.gps.longitude : null],
                ['Altitude', meta.gps && meta.gps.altitude], ['Timestamp', meta.gps && meta.gps.timestamp],
                ['Map link', meta.gps && meta.gps.hasGPS ? meta.gps.mapsUrl : null]
            ]);
            section('ICC COLOR PROFILE', [
                ['Description', meta.icc && meta.icc.description], ['Color space', meta.icc && meta.icc.colorSpace],
                ['Device class', meta.icc && meta.icc.deviceClass], ['Rendering intent', meta.icc && meta.icc.renderingIntent],
                ['CMM type', meta.icc && meta.icc.cmmType], ['Version', meta.icc && meta.icc.version]
            ]);
            if (meta.sources) {
                section('METADATA CATEGORIES', meta.sources.map(s => [
                    s.key, s.present ? (s.detail ? 'Present — ' + s.detail : 'Present') : 'Not present'
                ]));
            }
            if (meta.iptc) {
                section('IPTC', Object.entries(meta.iptc.fields).concat([['Character set', meta.iptc.charset]]));
            }
            if (meta.xmp) {
                section('XMP', Object.entries(meta.xmp.fields).concat([['Packet size', meta.xmp.packetSize + ' bytes']]));
            }
            if (meta.photoshop) {
                section('PHOTOSHOP 8BIM', [
                    ['Resource blocks', meta.photoshop.count],
                    ['Layer info', meta.photoshop.hasLayerInfo ? 'Present' : 'Not present'],
                    ['Block inventory', meta.photoshop.resources.join(', ')]
                ]);
            }
            if (meta.c2pa) {
                section('C2PA', [
                    ['Manifest', 'Present'],
                    ['Signature', meta.c2pa.hasSignature ? 'Signed claim found' : 'Not found'],
                    ['Claim generator', meta.c2pa.claimGenerator],
                    ['Assertions', meta.c2pa.assertions.join(', ')],
                    ['JUMBF labels', meta.c2pa.labels.join(', ')],
                    ['Size', meta.c2pa.bytes + ' bytes']
                ]);
            }
            if (meta.colorAnalysis) {
                section('DOMINANT COLORS', meta.colorAnalysis.dominantColors.map((c, i) => [`Color ${i + 1}`, `${c.hex} (${c.pct})`]));
            }
            return lines.join('\n');
        }

        function downloadBlob(content, filename, mime) {
            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        const previewCard = document.getElementById('previewCard');
        const previewFrame = document.getElementById('previewFrame');
        const previewImage = document.getElementById('previewImage');
        const previewError = document.getElementById('previewError');
        const formatBadge = document.getElementById('formatBadge');
        const dimVisual = document.getElementById('dimVisual');
        const dimLabelTop = document.getElementById('dimLabelTop');
        const dimLabelSide = document.getElementById('dimLabelSide');
        const dimBox = document.getElementById('dimBox');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const errorBanner = document.getElementById('errorBanner');
        const results = document.getElementById('results');
        const actionBar = document.getElementById('actionBar');

        let currentObjectURL = null;
        let lastMetadata = null;

        function pickImageFile(fileList) {
            const files = Array.from(fileList || []);
            return files.find(f => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(f.name)) || files[0] || null;
        }

        function loadImageSafe(img, url) {
            return new Promise((resolve) => {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = url;
            });
        }

        function updateDimensionVisual(width, height) {
            if (!width || !height) { dimVisual.classList.remove('show'); return; }
            dimVisual.classList.add('show');
            const maxBoxSize = 130;
            let boxW, boxH;
            if (width >= height) { boxW = maxBoxSize; boxH = Math.max(6, Math.round(maxBoxSize * (height / width))); }
            else { boxH = maxBoxSize; boxW = Math.max(6, Math.round(maxBoxSize * (width / height))); }
            dimLabelTop.textContent = `${width}px`;
            dimLabelSide.textContent = `${height}px`;
            dimBox.style.width = boxW + 'px';
            dimBox.style.height = boxH + 'px';
        }

        function resetUI() {
            errorBanner.classList.remove('visible'); errorBanner.textContent = '';
            previewImage.style.display = 'none';
            previewError.style.display = 'none';
            formatBadge.style.display = 'none';
            previewCard.classList.remove('visible');
            dimVisual.classList.remove('show');
            results.classList.remove('visible');
            actionBar.classList.remove('visible');
        }

        function showLoading(on) {
            loadingOverlay.classList.toggle('visible', on);
            previewFrame.classList.toggle('scanning', on);
        }

        function showFatalError(msg) {
            errorBanner.textContent = '⚠️ ' + msg;
            errorBanner.classList.add('visible');
        }

        async function handleFile(file) {
            resetUI();
            showLoading(true);
            try {
                const buffer = await file.arrayBuffer();
                const format = detectFormat(buffer);
                if (!format) {
                    showFatalError("Unrecognized file format — this doesn't look like a supported image (JPG, PNG, GIF, WebP, BMP or TIFF).");
                    return;
                }
                const meta = await buildMetadata(file, buffer, format);

                if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
                currentObjectURL = URL.createObjectURL(file);
                const img = new Image();
                const loaded = await loadImageSafe(img, currentObjectURL);

                previewCard.classList.add('visible');
                formatBadge.textContent = format;
                formatBadge.style.display = 'inline-block';

                if (loaded) {
                    if (!meta.image.width) { meta.image.width = img.naturalWidth; meta.image.height = img.naturalHeight; }
                    recomputeDerived(meta);
                    previewImage.src = currentObjectURL;
                    previewImage.style.display = 'block';
                    previewError.style.display = 'none';
                    try { meta.colorAnalysis = analyzeColors(img); } catch (e) { console.warn('Color analysis failed', e); }
                } else {
                    previewImage.style.display = 'none';
                    previewError.style.display = 'block';
                }
                updateDimensionVisual(meta.image.width, meta.image.height);

                lastMetadata = meta;
                renderAllCards(meta);
                results.classList.add('visible');
                actionBar.classList.add('visible');
            } catch (err) {
                console.error(err);
                showFatalError(err && err.message ? err.message : 'Failed to read this file.');
            } finally {
                showLoading(false);
            }
        }

        ['dragover', 'dragenter'].forEach(evt => dropzone.addEventListener(evt, (e) => {
            e.preventDefault(); dropzone.classList.add('drag-over');
        }));
        ['dragleave', 'dragend'].forEach(evt => dropzone.addEventListener(evt, () => dropzone.classList.remove('drag-over')));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault(); dropzone.classList.remove('drag-over');
            const file = pickImageFile(e.dataTransfer.files);
            if (file) handleFile(file);
        });
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => e.preventDefault());

        fileInput.addEventListener('change', () => {
            const file = pickImageFile(fileInput.files);
            if (file) handleFile(file);
        });

        document.getElementById('copyAllBtn').addEventListener('click', (e) => {
            if (!lastMetadata) return;
            copyToClipboard(buildTextReport(lastMetadata), e.currentTarget);
        });
        document.getElementById('downloadJsonBtn').addEventListener('click', () => {
            if (!lastMetadata) return;
            downloadBlob(JSON.stringify(lastMetadata, null, 2), `${getBaseName(lastMetadata.fileInfo.name)}_metadata.json`, 'application/json');
        });
        document.getElementById('downloadTxtBtn').addEventListener('click', () => {
            if (!lastMetadata) return;
            downloadBlob(buildTextReport(lastMetadata), `${getBaseName(lastMetadata.fileInfo.name)}_metadata.txt`, 'text/plain');
        });
        document.getElementById('clearBtn').addEventListener('click', () => {
            if (currentObjectURL) { URL.revokeObjectURL(currentObjectURL); currentObjectURL = null; }
            lastMetadata = null;
            fileInput.value = '';
            resetUI();
        });

        // Back button: return to wherever this tool was opened from, if possible
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.body.classList.add('page-leaving');
                setTimeout(() => {
                    if (window.history.length > 1) {
                        window.history.back();
                    } else {
                        window.location.href = backBtn.getAttribute('href');
                    }
                }, 220);
            });
        }
        // Guard against a stuck fade if the browser restores this page from cache
        window.addEventListener('pageshow', () => {
            document.body.classList.remove('page-leaving');
        });
    