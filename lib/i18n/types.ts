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
  renewal: {
    tenantHeading: string;
    tenantMessageTemplate: string;
    adminHeading: string;
    adminCaption: string;
    unavailable: string;
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
    billBreakdownTemplate: string;
    total: string;
    lastUpdatedTemplate: string;
    latestUpdate: {
      label: string;
      repairDone: string;
      claimConfirmed: string;
      noteLabel: string;
    };
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
    claim: {
      dateLabel: string;
      suffixLabel: string;
      suffixHint: string;
      submit: string;
      submitting: string;
      success: string;
      reportedTemplate: string;
      maskedTemplate: string;
      errors: {
        date: string;
        suffix: string;
        generic: string;
      };
    };
    repairs: {
      sectionHeading: string;
      sectionCaption: string;
      empty: string;
      unavailable: string;
      form: {
        categoryLabel: string;
        categoryPlaceholder: string;
        noteLabel: string;
        notePlaceholder: string;
        noteHint: string;
        warning: string;
        submit: string;
        submitting: string;
        success: string;
      };
      history: {
        submittedOn: string;
        doneOn: string;
        visitTime: string;
        status: {
          pending: string;
          scheduled: string;
          in_progress: string;
          done: string;
        };
      };
      categories: {
        plumbing: string;
        electrical: string;
        appliance: string;
        other: string;
      };
      errors: {
        category: string;
        note: string;
        unavailable: string;
        rate: string;
        generic: string;
      };
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
    claims: {
      sectionHeading: string;
      empty: string;
      unavailable: string;
      room: string;
      period: string;
      claimedOn: string;
      bankLast5: string;
      paidOnLabel: string;
      noteLabel: string;
      notePlaceholder: string;
      confirm: string;
      confirming: string;
      errors: {
        date: string;
        note: string;
        notFound: string;
        paid: string;
        unavailable: string;
        rate: string;
        generic: string;
      };
    };
    repairs: {
      sectionHeading: string;
      empty: string;
      emptyActive: string;
      emptyCompleted: string;
      unavailable: string;
      room: string;
      category: string;
      note: string;
      submittedOn: string;
      status: string;
      visitStart: string;
      visitEnd: string;
      active: string;
      completed: string;
      pending: string;
      scheduled: string;
      inProgress: string;
      done: string;
      doneOn: string;
      saveStatus: string;
      savingStatus: string;
      statusSaved: string;
      expenseLabel: string;
      saveExpense: string;
      savingExpense: string;
      expenseTotal: string;
      expenseSaved: string;
      markDone: string;
      marking: string;
      noteLabel: string;
      notePlaceholder: string;
      errors: {
        alreadyDone: string;
        notFound: string;
        invalidNote: string;
        invalidStatus: string;
        invalidWindow: string;
        invalidAmount: string;
        notDone: string;
        unavailable: string;
        rate: string;
        generic: string;
      };
    };
  };
};
