export type Dictionary = {
  meta: {
    siteName: string;
    description: string;
    homeTitle: string;
    loginTitle: string;
    adminTitle: string;
    adminLoginTitle: string;
  };
  common: {
    room: string;
    logOut: string;
    switchLocale: string;
    switchLocaleLabel: string;
  };
  login: {
    heading: string;
    subtitle: string;
    roomLabel: string;
    codeLabel: string;
    codePlaceholder: string;
    checking: string;
    signIn: string;
    landlordPrompt: string;
    adminArea: string;
    errors: {
      invalidCredentials: string;
    };
  };
  room: {
    headingTemplate: string;
    bills: string;
    payments: string;
    leaseDates: string;
    due: string;
    received: string;
    period: string;
    status: {
      open: string;
      paid: string;
    };
    rent: string;
    water: string;
    electricity: string;
    total: string;
    lastUpdatedTemplate: string;
    unavailableHeading: string;
    unavailableMessage: string;
    emptyBills: string;
    emptyPayments: string;
    emptyLease: string;
    notAvailable: string;
    leaseStart: string;
    leaseEnd: string;
    renewalDue: string;
    bankAccount: {
      heading: string;
      bankName: string;
      recipientName: string;
      bankCode: string;
      accountNo: string;
    };
  };
  denied: {
    heading: string;
    message: string;
    backToDashboard: string;
  };
  adminLogin: {
    heading: string;
    subtitle: string;
    passwordLabel: string;
    checking: string;
    signIn: string;
    errors: {
      accessDenied: string;
    };
  };
  admin: {
    heading: string;
    subtitle: string;
    resetSectionHeading: string;
    roomLabel: string;
    newCodeLabel: string;
    codePlaceholder: string;
    resetting: string;
    resetCode: string;
    errors: {
      accessDenied: string;
      invalidRoom: string;
      invalidPassword: string;
    };
    successTemplate: string;
    copy: string;
    copied: string;
    warning: string;
    resetAnother: string;
    bank: {
      sectionHeading: string;
      bankName: string;
      recipientName: string;
      bankCode: string;
      accountNo: string;
      bankNamePlaceholder: string;
      recipientNamePlaceholder: string;
      bankCodePlaceholder: string;
      accountNoPlaceholder: string;
      bankCodeHint: string;
      accountNoHint: string;
      save: string;
      saving: string;
      saved: string;
      unavailable: string;
      errors: {
        invalid: string;
        generic: string;
      };
    };
  };
};
