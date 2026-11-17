// Fields from the live spec's EmailSettingRequest/EmailSettingGetRequest,
// confirmed against a real authenticated master/email-setting/get response.
// AuthFlag/EncrptMethod are real integer enums whose full option sets are
// now CONFIRMED live via master/email-setting/options/get (previously
// undocumented — see this session's own investigation report for why the
// earlier generic config only exposed them as plain number inputs).
export interface EmailSettingRow {
  emailSettingId: string;
  emailName: string;
  emailAddress: string;
  authFlag: number | null;
  userName: string | null;
  smtpServer: string | null;
  port: string | null;
  encrptMethod: number | null;
  encrptMethodName: string | null;
  targetName: string | null;
  hasPassword: boolean;
  isActive: boolean;
}

// One named option from master/email-setting/options/get's own real
// `authentication`/`encryptionMethods` arrays — value/name/description, all
// real (description shown nowhere in this UI, kept only for completeness).
export interface SmtpOption {
  value: number;
  name: string;
  description: string;
}

export interface SmtpOptionsResponse {
  authentication: SmtpOption[];
  encryptionMethods: SmtpOption[];
}
