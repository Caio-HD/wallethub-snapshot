/** Monta um extrato OFX 1.x SGML mínimo, para testes de import e reconciliação. */

const ofxHeader = [
  'OFXHEADER:100',
  'DATA:OFXSGML',
  'VERSION:102',
  'SECURITY:NONE',
  'ENCODING:UTF-8',
  'CHARSET:NONE',
  'COMPRESSION:NONE',
  'OLDFILEUID:NONE',
  'NEWFILEUID:NONE',
  '<OFX>',
  '<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>',
  '<DTSERVER>20261020195815[0:GMT]</DTSERVER><LANGUAGE>POR</LANGUAGE>',
  '<FI><ORG>NU PAGAMENTOS S.A.</ORG><FID>260</FID></FI></SONRS></SIGNONMSGSRSV1>',
  '<BANKMSGSRSV1><STMTTRNRS><TRNUID>1</TRNUID>',
  '<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>',
  '<BANKTRANLIST><DTSTART>20261001</DTSTART><DTEND>20261019</DTEND>',
].join('\n');

export const buildOfx = (transactions: string[], ledgerBalance: string | null = '668.02'): Buffer =>
  Buffer.from(
    [
      ofxHeader,
      ...transactions,
      '</BANKTRANLIST>',
      ...(ledgerBalance === null
        ? []
        : [
            `<LEDGERBAL><BALAMT>${ledgerBalance}</BALAMT><DTASOF>20261019000000[-3:BRT]</DTASOF></LEDGERBAL>`,
          ]),
      '</STMTTRNRS></BANKMSGSRSV1></OFX>',
    ].join('\n'),
    'latin1',
  );

export const stmtrn = (opts: {
  dtposted: string;
  trnamt: string;
  name: string;
  fitid: string;
}): string =>
  [
    '<STMTTRN>',
    `<TRNTYPE>${opts.trnamt.startsWith('-') ? 'DEBIT' : 'CREDIT'}</TRNTYPE>`,
    `<DTPOSTED>${opts.dtposted}</DTPOSTED>`,
    `<TRNAMT>${opts.trnamt}</TRNAMT>`,
    `<FITID>${opts.fitid}</FITID>`,
    `<NAME>${opts.name}</NAME>`,
    '</STMTTRN>',
  ].join('\n');
