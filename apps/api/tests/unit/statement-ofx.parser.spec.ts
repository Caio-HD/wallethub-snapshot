import { parseStatementOFX } from '../../src/modules/statement-import/statement-ofx.parser';

// ────────────────────────────────────────────────────────────────────────────
// Fixtures inline — nenhum arquivo externo para respeitar regra de testes separados
// ────────────────────────────────────────────────────────────────────────────

/** OFX 1.x SGML — formato típico de Inter/Nubank (UTF-8) */
const OFX_SGML_UTF8 = `
OFXHEADER:100
DATA:OFXSGML
VERSION:151
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>077
<ACCTID>12345678
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250101
<DTEND>20250131
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250110120000
<TRNAMT>-50.00
<FITID>TXN001
<NAME>Padaria Feliz
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250115000000[-3:BRT]
<TRNAMT>1200.00
<FITID>TXN002
<NAME>Salário
<MEMO>Depósito em conta
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250120
<TRNAMT>-0.00
<FITID>TXN003
<NAME>Taxa zero
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`.trim();

/** OFX 2.x XML — formato moderno (ex: Nubank exportação recente, Inter API) */
const OFX_XML_V2 = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" DATA="OFXSGML" VERSION="211" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>260</BANKID>
          <ACCTID>987654321</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20251201120000</DTPOSTED>
            <TRNAMT>-150.75</TRNAMT>
            <FITID>XML001</FITID>
            <NAME>Mercado &amp; Cia</NAME>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>INT</TRNTYPE>
            <DTPOSTED>20251215000000</DTPOSTED>
            <TRNAMT>12.30</TRNAMT>
            <FITID>XML002</FITID>
            <NAME>Rendimento CDB</NAME>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

/** OFX 1.x SGML simulando encoding ISO-8859-1 — caracteres brasileiros */
function buildIsoBuffer(text: string): Buffer {
  // Criar buffer em latin1 para simular arquivo exportado por banco brasileiro
  return Buffer.from(text, 'latin1');
}

const OFX_SGML_ISO_TEXT = `
OFXHEADER:100
DATA:OFXSGML
VERSION:151
SECURITY:NONE
ENCODING:USASCII
CHARSET:8859
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>237
<ACCTID>55500001
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250305000000
<TRNAMT>-75.50
<FITID>ISO001
<NAME>Padaria Pão & Cia
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250310000000
<TRNAMT>-22.90
<FITID>ISO002
<NAME>Café São João
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`.trim();

/** OFX sem nenhuma transação */
const OFX_EMPTY = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`.trim();

/** FITID duplicado — deve ser deduplicado */
const OFX_DUPLICATE_FITID = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250101
<TRNAMT>-100.00
<FITID>DUP001
<NAME>Transação A
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250101
<TRNAMT>-100.00
<FITID>DUP001
<NAME>Transação A (duplicata)
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`.trim();

// ────────────────────────────────────────────────────────────────────────────
// Testes
// ────────────────────────────────────────────────────────────────────────────

describe('parseStatementOFX', () => {
  describe('OFX 1.x SGML (UTF-8)', () => {
    const buf = Buffer.from(OFX_SGML_UTF8, 'utf8');

    it('retorna 2 linhas (transação com valor zero é ignorada)', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows).toHaveLength(2);
    });

    it('parseia data corretamente (descarta hora e timezone)', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows[0].occurredAt).toBe('2025-01-10');
      // Data com offset [-3:BRT] deve truncar para data apenas
      expect(rows[1].occurredAt).toBe('2025-01-15');
    });

    it('usa Math.abs no amount (débitos têm sinal negativo no OFX)', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows[0].amount).toBe(50);
      expect(rows[1].amount).toBe(1200);
    });

    it('mapeia TRNTYPE=DEBIT para hint=expense', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows[0].hint).toBe('expense');
    });

    it('mapeia TRNTYPE=CREDIT para hint=income', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows[1].hint).toBe('income');
    });

    it('preserva FITID', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows[0].fitid).toBe('TXN001');
    });

    it('usa NAME como descrição', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows[0].description).toBe('Padaria Feliz');
    });

    it('extrai bankInfo corretamente', () => {
      const { bankInfo } = parseStatementOFX(buf);
      expect(bankInfo?.bankId).toBe('077');
      expect(bankInfo?.acctId).toBe('12345678');
    });
  });

  describe('OFX 2.x XML', () => {
    const buf = Buffer.from(OFX_XML_V2, 'utf8');

    it('parseia 2 transações do XML', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows).toHaveLength(2);
    });

    it('decodifica entidade HTML &amp; na descrição', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows[0].description).toBe('Mercado & Cia');
    });

    it('mapeia TRNTYPE=INT para hint=income', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows[1].hint).toBe('income');
    });

    it('extrai bankInfo do XML', () => {
      const { bankInfo } = parseStatementOFX(buf);
      expect(bankInfo?.bankId).toBe('260');
      expect(bankInfo?.acctId).toBe('987654321');
    });
  });

  describe('OFX 1.x SGML (ISO-8859-1 / Bradesco)', () => {
    const buf = buildIsoBuffer(OFX_SGML_ISO_TEXT);

    it('parseia 2 transações com encoding ISO-8859-1', () => {
      const { rows } = parseStatementOFX(buf);
      expect(rows).toHaveLength(2);
    });

    it('preserva caracteres especiais (acentos) do encoding brasileiro', () => {
      const { rows } = parseStatementOFX(buf);
      // Verificar que a descrição não tem caracteres corrompidos
      expect(rows[0].description).toContain('Pão');
      expect(rows[1].description).toContain('São');
    });

    it('extrai bankId do Bradesco (237)', () => {
      const { bankInfo } = parseStatementOFX(buf);
      expect(bankInfo?.bankId).toBe('237');
    });
  });

  describe('BANKACCTFROM com BRANCHID (agência)', () => {
    const OFX_WITH_BRANCH = `
OFXHEADER:100
DATA:OFXSGML
VERSION:151
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM>
<BANKID>341
<BRANCHID>1234
<ACCTID>00056789-0
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250110
<TRNAMT>-10.00
<FITID>BR001
<NAME>Teste
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
`.trim();

    it('extrai bankId, branchId e acctId', () => {
      const { bankInfo } = parseStatementOFX(Buffer.from(OFX_WITH_BRANCH, 'utf8'));
      expect(bankInfo?.bankId).toBe('341');
      expect(bankInfo?.branchId).toBe('1234');
      expect(bankInfo?.acctId).toBe('00056789-0');
    });
  });

  describe('Edge cases', () => {
    it('retorna rows vazio para arquivo sem <STMTTRN>', () => {
      const { rows } = parseStatementOFX(Buffer.from(OFX_EMPTY, 'utf8'));
      expect(rows).toHaveLength(0);
    });

    it('deduplicação por FITID: mantém apenas 1 de 2 transações idênticas', () => {
      const { rows } = parseStatementOFX(Buffer.from(OFX_DUPLICATE_FITID, 'utf8'));
      expect(rows).toHaveLength(1);
      expect(rows[0].fitid).toBe('DUP001');
    });

    it('ignora transação com TRNAMT=0.00', () => {
      const { rows } = parseStatementOFX(Buffer.from(OFX_SGML_UTF8, 'utf8'));
      const zeroRow = rows.find((r) => r.fitid === 'TXN003');
      expect(zeroRow).toBeUndefined();
    });

    it('não lança exceção para buffer vazio', () => {
      expect(() => parseStatementOFX(Buffer.from(''))).not.toThrow();
      const { rows } = parseStatementOFX(Buffer.from(''));
      expect(rows).toHaveLength(0);
    });

    it('não lança exceção para conteúdo não-OFX (PDF renomeado)', () => {
      const fakePdf = Buffer.from('%PDF-1.4 garbage content here');
      expect(() => parseStatementOFX(fakePdf)).not.toThrow();
      const { rows } = parseStatementOFX(fakePdf);
      expect(rows).toHaveLength(0);
    });
  });
});
