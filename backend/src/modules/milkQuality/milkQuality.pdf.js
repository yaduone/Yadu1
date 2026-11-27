/**
 * milkQuality.pdf.js — Branded YaduONE milk quality report (A4, pdfkit).
 *
 * Layout is positioned by hand (zero page margins) so the header banner and
 * footer strip can run edge to edge; `ensureSpace` starts a new page with a
 * slim continuation banner when a section would not fit.
 */

const path = require('path');
const PDFDocument = require('pdfkit');
const moment = require('moment-timezone');
const config = require('../../config');

const LOGO_PATH = path.join(__dirname, '../../../assets/brand/yaduone-logo.png');

const BRAND = {
  name: 'YaduONE',
  tagline: 'Pure Milk  ·  Pure Health  ·  Pure Trust',
  email: 'yaduone111@gmail.com',
  phone: '+91 92867 34980',
};

const PAGE = { w: 595.28, h: 841.89, m: 40 };
const CONTENT_W = PAGE.w - PAGE.m * 2;
const FOOTER_H = 38;
const BOTTOM_LIMIT = PAGE.h - FOOTER_H - 18;

const C = {
  ink: '#0B2540',
  muted: '#5B7083',
  faint: '#8DA2B5',
  line: '#DCE6EF',
  soft: '#F3F8FC',
  zebra: '#F8FBFD',
  green: '#2F9E5B',
  teal: '#1C7FA6',
  navy: '#1D3F8F',
};

const TONES = {
  ok: { bg: '#E3F5EA', fg: '#1E7B45' },
  low: { bg: '#FFF1DC', fg: '#B45309' },
  high: { bg: '#FFF1DC', fg: '#B45309' },
  not_tested: { bg: '#EEF2F6', fg: '#64748B' },
  negative: { bg: '#E3F5EA', fg: '#1E7B45' },
  positive: { bg: '#FDE7E7', fg: '#B91C1C' },
};

const SAMPLE_ACCENTS = { cow: '#2F9E5B', buffalo: '#1D3F8F', toned: '#1C7FA6' };

const GRADE_TONES = {
  excellent: { bg: '#E3F5EA', fg: '#1E7B45' },
  good: { bg: '#E4EFFB', fg: '#1D4F91' },
  satisfactory: { bg: '#FFF1DC', fg: '#B45309' },
};

function brandGradient(doc, x1, y1, x2, y2) {
  return doc.linearGradient(x1, y1, x2, y2)
    .stop(0, C.green)
    .stop(0.55, C.teal)
    .stop(1, C.navy);
}

function longDate(date) {
  return moment.tz(date, 'YYYY-MM-DD', config.timezone).format('D MMMM YYYY');
}

function weekday(date) {
  return moment.tz(date, 'YYYY-MM-DD', config.timezone).format('dddd');
}

function reportNumber(report) {
  const area = String(report.area_id || '').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();
  return `YQ-${String(report.date).replace(/-/g, '')}${area ? `-${area}` : ''}`;
}

function formatSampleTime(hhmm) {
  if (!hhmm) return '—';
  return moment(hhmm, 'HH:mm').format('h:mm A');
}

/** Rounded pill with centred bold text; returns its width. */
function pill(doc, x, y, text, tone, { fontSize = 7.5, padX = 8, h = 16, width } = {}) {
  doc.font('Helvetica-Bold').fontSize(fontSize);
  const w = width || doc.widthOfString(text) + padX * 2;
  doc.roundedRect(x, y, w, h, h / 2).fill(tone.bg);
  doc.fillColor(tone.fg).text(text, x, y + (h - fontSize) / 2 + 0.6, { width: w, align: 'center', lineBreak: false });
  return w;
}

function checkMark(doc, cx, cy, r, color) {
  doc.circle(cx, cy, r).fill(color);
  doc.save()
    .lineWidth(r * 0.22).lineCap('round').lineJoin('round').strokeColor('#FFFFFF')
    .moveTo(cx - r * 0.42, cy + r * 0.02)
    .lineTo(cx - r * 0.1, cy + r * 0.34)
    .lineTo(cx + r * 0.45, cy - r * 0.3)
    .stroke()
    .restore();
}

function drawLogoTile(doc, x, y, size) {
  doc.roundedRect(x, y, size, size, size * 0.22).fill('#FFFFFF');
  const pad = size * 0.08;
  doc.image(LOGO_PATH, x + pad, y + pad, { width: size - pad * 2, height: size - pad * 2 });
}

function drawHeaderBanner(doc, report) {
  const h = 122;
  doc.save();
  doc.moveTo(0, 0)
    .lineTo(PAGE.w, 0)
    .lineTo(PAGE.w, h - 22)
    .bezierCurveTo(PAGE.w * 0.72, h + 10, PAGE.w * 0.36, h - 40, 0, h - 4)
    .closePath()
    .fill(brandGradient(doc, 0, 0, PAGE.w, h));

  // Soft decorative bubbles (milk droplets) on the banner.
  doc.fillColor('#FFFFFF').fillOpacity(0.08);
  doc.circle(PAGE.w - 40, 12, 74).fill();
  doc.circle(PAGE.w - 168, 104, 30).fill();
  doc.circle(250, -10, 40).fill();
  doc.fillOpacity(1);
  doc.restore();

  drawLogoTile(doc, PAGE.m, 24, 62);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(25)
    .text(BRAND.name, PAGE.m + 78, 31, { lineBreak: false });
  doc.font('Helvetica').fontSize(9.5).fillColor('#E6F4FF')
    .text(BRAND.tagline, PAGE.m + 79, 62, { lineBreak: false });

  const rw = 210;
  const rx = PAGE.w - PAGE.m - rw;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#D7ECFF')
    .text('DAILY MILK QUALITY REPORT', rx, 30, { width: rw, align: 'right', characterSpacing: 1.4, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(17).fillColor('#FFFFFF')
    .text(longDate(report.date), rx, 44, { width: rw, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor('#E6F4FF')
    .text(`${weekday(report.date)}  ·  Report No. ${reportNumber(report)}`, rx, 67, { width: rw, align: 'right', lineBreak: false });

  return h + 8;
}

function drawContinuationBanner(doc, report) {
  const h = 54;
  doc.rect(0, 0, PAGE.w, h).fill(brandGradient(doc, 0, 0, PAGE.w, h));
  drawLogoTile(doc, PAGE.m, 11, 32);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13)
    .text(BRAND.name, PAGE.m + 42, 16, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor('#E6F4FF')
    .text(`Daily Milk Quality Report  ·  ${longDate(report.date)} (continued)`, PAGE.m + 42, 33, { lineBreak: false });
  return h + 22;
}

function drawFooter(doc, generatedAt, pageNo, pageCount) {
  const y = PAGE.h - FOOTER_H;
  doc.rect(0, y, PAGE.w, FOOTER_H).fill(brandGradient(doc, 0, y, PAGE.w, y));
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF')
    .text(BRAND.name, PAGE.m, y + 15, { continued: true, lineBreak: false })
    .font('Helvetica').fillColor('#E6F4FF')
    .text(`   ${BRAND.email}   ·   ${BRAND.phone}`, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#E6F4FF')
    .text(`Generated ${generatedAt}   ·   Page ${pageNo} of ${pageCount}`, PAGE.m, y + 16, {
      width: CONTENT_W, align: 'right', lineBreak: false,
    });
}

function drawInfoStrip(doc, y, report, areaName) {
  const h = 46;
  doc.roundedRect(PAGE.m, y, CONTENT_W, h, 12).fill(C.soft);
  const cells = [
    ['AREA', areaName || '—'],
    ['VARIETIES TESTED', report.samples.map((s) => s.short_label.replace(/ Milk$/, '')).join(', ') || '—'],
    ['COLLECTED AT', formatSampleTime(report.sample_time)],
    ['TESTED BY', report.tested_by || 'YaduONE Quality Team'],
  ];
  const widths = [115, 175, 90, CONTENT_W - 380];
  let x = PAGE.m + 16;
  cells.forEach(([label, value], i) => {
    const w = widths[i] - 18;
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor(C.faint)
      .text(label, x, y + 10, { characterSpacing: 0.8, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink)
      .text(value, x, y + 23, { width: w, height: 13, ellipsis: true });
    x += widths[i];
  });
  return y + h + 14;
}

function drawSummary(doc, y, report) {
  const h = 62;
  const s = report.summary;
  doc.roundedRect(PAGE.m, y, CONTENT_W, h, 14).lineWidth(1).strokeColor(C.line).stroke();

  const allClear = s.parameters_tested > 0 && s.parameters_in_range === s.parameters_tested && s.tests_flagged === 0;
  checkMark(doc, PAGE.m + 32, y + h / 2, 16, allClear ? C.green : '#D97706');

  const textW = CONTENT_W - 230;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.ink)
    .text(allClear ? 'All quality checks passed' : 'Quality checks completed', PAGE.m + 60, y + 11, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.8).fillColor(C.muted)
    .text(`${s.parameters_in_range} of ${s.parameters_tested} parameters within reference range`, PAGE.m + 60, y + 30, {
      width: textW, lineBreak: false,
    });
  if (s.tests_done > 0) {
    doc.text(s.tests_flagged === 0
      ? `${s.tests_done} adulteration screens: none detected`
      : `${s.tests_flagged} of ${s.tests_done} adulteration screens: detected`, PAGE.m + 60, y + 43, {
      width: textW, lineBreak: false,
    });
  }

  if (report.grade) {
    const label = `GRADE  ·  ${report.grade_label.toUpperCase()}`;
    doc.font('Helvetica-Bold').fontSize(8.5);
    const w = doc.widthOfString(label) + 28;
    pill(doc, PAGE.m + CONTENT_W - w - 16, y + h / 2 - 12, label, GRADE_TONES[report.grade] || GRADE_TONES.good, {
      fontSize: 8.5, h: 24, width: w,
    });
  }
  return y + h + 18;
}

function sectionTitle(doc, y, title, accent, aside) {
  doc.roundedRect(PAGE.m, y + 1, 4, 14, 2).fill(accent);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(C.ink)
    .text(title, PAGE.m + 12, y + 2, { characterSpacing: 0.3, lineBreak: false });
  if (aside) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
      .text(aside, PAGE.m, y + 4, { width: CONTENT_W, align: 'right', lineBreak: false });
  }
  return y + 22;
}

const PARAM_COL_W = 150;
const ROW_H = 30;
const PDF_STATUS = { ok: 'In range', low: 'Low', high: 'High' };

/** One row per parameter, one column per milk variety: value, status pill, reference. */
function drawResultsTable(doc, y, samples) {
  const colW = (CONTENT_W - PARAM_COL_W) / samples.length;
  const headerH = 34;
  doc.roundedRect(PAGE.m, y, CONTENT_W, headerH, 8).fill(C.soft);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.muted)
    .text('PARAMETER', PAGE.m + 12, y + 14, { characterSpacing: 0.8, lineBreak: false });
  samples.forEach((sample, i) => {
    const x = PAGE.m + PARAM_COL_W + i * colW;
    doc.roundedRect(x + 12, y + 9, 7, 7, 2).fill(SAMPLE_ACCENTS[sample.milk_type] || C.teal);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.ink)
      .text(sample.short_label.toUpperCase(), x + 24, y + 8.5, { characterSpacing: 0.6, lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor(C.muted)
      .text(`${sample.in_range} of ${sample.tested} in range`, x + 12, y + 20, { lineBreak: false });
  });
  y += headerH;

  const rows = samples[0]?.parameters.length || 0;
  for (let r = 0; r < rows; r += 1) {
    if (r % 2 === 1) doc.rect(PAGE.m, y, CONTENT_W, ROW_H).fill(C.zebra);
    doc.font('Helvetica').fontSize(9.5).fillColor(C.ink)
      .text(samples[0].parameters[r].label, PAGE.m + 12, y + 10, { width: PARAM_COL_W - 20, lineBreak: false });

    samples.forEach((sample, i) => {
      const p = sample.parameters[r];
      const x = PAGE.m + PARAM_COL_W + i * colW;
      const tested = p.status !== 'not_tested';
      doc.font(tested ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(tested ? C.ink : C.faint)
        .text(tested ? p.display : 'Not tested', x + 12, y + 5, { lineBreak: false });
      if (tested) {
        const label = PDF_STATUS[p.status];
        doc.font('Helvetica-Bold').fontSize(6.6);
        const w = doc.widthOfString(label) + 12;
        pill(doc, x + colW - w - 10, y + 5, label, TONES[p.status], { fontSize: 6.6, h: 12, width: w });
      }
      doc.font('Helvetica').fontSize(7.2).fillColor(C.muted)
        .text(`Ref ${p.reference_display}`, x + 12, y + 18, { lineBreak: false });
    });
    y += ROW_H;
  }

  doc.moveTo(PAGE.m, y).lineTo(PAGE.m + CONTENT_W, y).lineWidth(0.8).strokeColor(C.line).stroke();
  return y + 18;
}

function drawTests(doc, y, report) {
  const gap = 10;
  const cols = 3;
  const tileW = (CONTENT_W - gap * (cols - 1)) / cols;
  const tileH = 34;
  report.test_results.forEach((t, i) => {
    const tx = PAGE.m + (i % cols) * (tileW + gap);
    const ty = y + Math.floor(i / cols) * (tileH + gap);
    doc.roundedRect(tx, ty, tileW, tileH, 10).lineWidth(0.8).strokeColor(C.line).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink)
      .text(t.label, tx + 12, ty + 12.5, { width: tileW - 100, height: 11, ellipsis: true });
    pill(doc, tx + tileW - 84, ty + 9, t.result_label, TONES[t.result] || TONES.not_tested, { width: 74 });
  });
  const rows = Math.ceil(report.test_results.length / cols);
  return y + rows * tileH + (rows - 1) * gap + 18;
}

function drawRemarks(doc, y, notes, height) {
  doc.roundedRect(PAGE.m, y, CONTENT_W, height, 12).fill(C.soft);
  doc.font('Helvetica').fontSize(9.5).fillColor(C.ink)
    .text(notes, PAGE.m + 16, y + 12, { width: CONTENT_W - 32, lineGap: 2 });
  return y + height + 16;
}

function drawSignOff(doc, y, report) {
  doc.font('Helvetica').fontSize(7.8).fillColor(C.faint)
    .text(
      'Reference ranges are typical values provided for guidance; natural milk composition varies with season, breed and feed. '
      + 'Results relate only to the samples tested on the date shown.',
      PAGE.m, y, { width: 300, lineGap: 1.5 },
    );
  const sx = PAGE.m + CONTENT_W - 170;
  doc.moveTo(sx, y + 18).lineTo(sx + 170, y + 18).lineWidth(0.8).strokeColor(C.line).stroke();
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.ink)
    .text(report.tested_by || 'YaduONE Quality Team', sx, y + 24, { width: 170, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(C.muted)
    .text('Quality In-charge, YaduONE', sx, y + 37, { width: 170, align: 'center', lineBreak: false });
  return y + 52;
}

/**
 * Render a decorated report (see milkQuality.service#decorateReport) to a PDF.
 * @returns {Promise<Buffer>}
 */
function renderMilkQualityPdf(report, { areaName = '', generatedAt = new Date() } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      info: {
        Title: `${BRAND.name} Milk Quality Report — ${longDate(report.date)}`,
        Author: BRAND.name,
        Subject: 'Daily milk quality report',
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      let y = drawHeaderBanner(doc, report);
      const ensureSpace = (needed) => {
        if (y + needed <= BOTTOM_LIMIT) return;
        doc.addPage({ size: 'A4', margin: 0 });
        y = drawContinuationBanner(doc, report);
      };

      y = drawInfoStrip(doc, y, report, areaName);
      y = drawSummary(doc, y, report);

      if (report.samples.length > 0) {
        ensureSpace(22 + 34 + report.samples[0].parameters.length * ROW_H + 18);
        y = sectionTitle(doc, y, 'TEST RESULTS', C.green, 'Measured on the day\'s collected samples');
        y = drawResultsTable(doc, y, report.samples);
      }

      if (report.test_results.some((t) => t.result !== 'not_tested')) {
        const rows = Math.ceil(report.test_results.length / 3);
        ensureSpace(22 + rows * 44 + 8);
        y = sectionTitle(doc, y, 'ADULTERATION SCREENING', C.navy, 'Common adulterants checked in today’s milk');
        y = drawTests(doc, y, report);
      }

      if (report.notes) {
        doc.font('Helvetica').fontSize(9.5);
        const textH = doc.heightOfString(report.notes, { width: CONTENT_W - 32, lineGap: 2 });
        const boxH = Math.max(34, textH + 22);
        ensureSpace(22 + boxH + 16);
        y = sectionTitle(doc, y, 'REMARKS', C.teal);
        y = drawRemarks(doc, y, report.notes, boxH);
      }

      ensureSpace(52);
      drawSignOff(doc, y, report);

      const stamp = moment(generatedAt).tz(config.timezone).format('D MMM YYYY, h:mm A');
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        drawFooter(doc, `${stamp} IST`, i + 1, range.count);
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function pdfFilename(report) {
  return `YaduONE-Milk-Quality-Report-${report.date}.pdf`;
}

module.exports = { renderMilkQualityPdf, pdfFilename };
