# Evidências de chamadas do app LoBank à Celcoin (2026-11-11)

Gerado em 2026-11-11 19:33:07 (horário de Brasília) a partir de `data/evidencias/2026-11-11.jsonl` (cópia em [`evidencias-qa-2026-11-11.jsonl`](evidencias-qa-2026-11-11.jsonl)).

- Chamadas registradas: **58** (sandbox real: 58; modo simulado: 0)
- Origem: servidor do app (`src/celcoin.js`). Dados sensíveis mascarados na gravação; token e credenciais nunca entram.

## Índice

| Ação no app | Pedidos | Chamadas |
| --- | --- | --- |
| `POST /api/onboarding/pf` | 1 | 2 |
| `GET /api/onboarding/status` | 4 | 6 |
| `POST /api/onboarding/pj` | 1 | 1 |
| `GET /api/balance` | 4 | 4 |
| `GET /api/statement` | 2 | 2 |
| `PUT /api/me` | 2 | 3 |
| `GET /api/pix/keys` | 2 | 2 |
| `POST /api/pix/keys/evp` | 2 | 5 |
| `POST /api/pix/lookup` | 2 | 2 |
| `POST /api/pix/transfer` | 4 | 8 |
| `POST /api/pix/manual` | 1 | 1 |
| `GET /api/pix/transfer/:id` | 4 | 4 |
| `POST /api/pix/qrcode` | 1 | 1 |
| `POST /api/pix/emv` | 1 | 2 |
| `POST /api/dda/subscribe` | 1 | 1 |
| `DELETE /api/pix/keys/:chave` | 2 | 6 |
| `GET /api/dda` | 3 | 5 |
| `POST /api/dda/test-invoices` | 1 | 1 |
| `POST /api/bills/authorize` | 1 | 1 |
| `POST /api/dda/cancel` | 1 | 1 |

## `POST /api/onboarding/pf`

### Pedido 68cdca9f8223 (19:18:01)

**19:18:01 · POST `/v5/token` · HTTP 200 · 321 ms · modo sandbox**

Requisição:

```json
{
  "observacao": "credenciais omitidas"
}
```

Resposta:

```json
{
  "observacao": "token emitido (omitido)"
}
```

**19:18:08 · POST `/onboarding/v1/onboarding-proposal/natural-person` · HTTP 200 · 7193 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pf-1794435480705-54b4e55e`, `proposalId`=`f2176523-ff9d-4b78-9353-049c2b64e46d`

Requisição:

```json
{
  "clientCode": "lobank-pf-1794435480705-54b4e55e",
  "documentNumber": "*********05",
  "phoneNumber": "*********4561",
  "email": "qa***@example.com",
  "motherName": "Maria Q. T.",
  "fullName": "Teste Q. H. P.",
  "birthDate": "**-**-1992",
  "address": {
    "postalCode": "***",
    "street": "***",
    "number": "***",
    "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
    "city": "Barueri",
    "state": "SP"
  },
  "isPoliticallyExposedPerson": false,
  "onboardingType": "BAAS"
}
```

Resposta:

```json
{
  "body": {
    "proposalId": "f2176523-ff9d-4b78-9353-049c2b64e46d",
    "clientCode": "lobank-pf-1794435480705-54b4e55e",
    "documentNumber": "*********05"
  },
  "version": "1.0.0",
  "status": "PROCESSING"
}
```

## `GET /api/onboarding/status`

### Pedido c3ecf303fb14 (19:18:24)

**19:18:24 · GET `/onboarding/v1/onboarding-proposal?proposalId=f2176523-ff9d-4b78-9353-049c2b64e46d` · HTTP 200 · 423 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "body": {
    "limit": 200,
    "currentPage": 1,
    "limitPerPage": 200,
    "totalPages": 1,
    "totalItems": 1,
    "proposal": [
      {
        "proposalId": "f2176523-ff9d-4b78-9353-049c2b64e46d",
        "clientCode": "lobank-pf-1794435480705-54b4e55e",
        "documentNumber": "*********05",
        "status": "PENDING_DOCUMENTSCOPY",
        "proposalType": "PF",
        "createdAt": "2026-11-11T19:18:11.479Z",
        "updatedAt": "2026-11-11T19:18:18.806Z",
        "documentscopys": [
          {
            "proposalId": "f2176523-ff9d-4b78-9353-049c2b64e46d",
            "documentNumber": "*********05",
            "documentscopyId": "6af4e9aa73a26b0002c478e2",
            "status": "PENDING",
            "url": "https://celcoin.cadastro.io/b985eb2d79f894e3e6130a747e02db26",
            "createdAt": "2026-11-11T19:18:10.789Z",
            "updateAt": "2026-11-11T19:18:18.688Z"
          }
        ]
      }
    ]
  },
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

### Pedido 434314a1f9e9 (19:18:52)

**19:18:52 · GET `/onboarding/v1/onboarding-proposal?proposalId=e6884ef4-026f-47be-9c51-f9e3b7a08404` · HTTP 200 · 293 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "body": {
    "limit": 200,
    "currentPage": 1,
    "limitPerPage": 200,
    "totalPages": 1,
    "totalItems": 1,
    "proposal": [
      {
        "proposalId": "e6884ef4-026f-47be-9c51-f9e3b7a08404",
        "clientCode": "lobank-pj-1794435513260-29b3ce0e",
        "documentNumber": "************79",
        "status": "PENDING_DOCUMENTSCOPY",
        "proposalType": "PJ",
        "createdAt": "2026-11-11T19:18:42.429Z",
        "updatedAt": "2026-11-11T19:18:48.967Z",
        "documentscopys": [
          {
            "proposalId": "e6884ef4-026f-47be-9c51-f9e3b7a08404",
            "documentNumber": "*********69",
            "documentscopyId": "6af4e9c8694a4300026ece71",
            "status": "PENDING",
            "url": "https://celcoin.cadastro.io/5ab639ae1f725fda3cabdaf958b99763",
            "createdAt": "2026-11-11T19:18:41.511Z",
            "updateAt": "2026-11-11T19:18:48.853Z"
          }
        ]
      }
    ]
  },
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

### Pedido 0078cb544a73 (19:22:01)

**19:22:01 · GET `/onboarding/v1/onboarding-proposal?proposalId=e6884ef4-026f-47be-9c51-f9e3b7a08404` · HTTP 200 · 317 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "body": {
    "limit": 200,
    "currentPage": 1,
    "limitPerPage": 200,
    "totalPages": 1,
    "totalItems": 1,
    "proposal": [
      {
        "proposalId": "e6884ef4-026f-47be-9c51-f9e3b7a08404",
        "clientCode": "lobank-pj-1794435513260-29b3ce0e",
        "documentNumber": "************79",
        "status": "RESOURCE_CREATED",
        "proposalType": "PJ",
        "createdAt": "2026-11-11T19:18:42.429Z",
        "updatedAt": "2026-11-11T19:21:55.042Z",
        "documentscopys": [
          {
            "proposalId": "e6884ef4-026f-47be-9c51-f9e3b7a08404",
            "documentNumber": "*********69",
            "documentscopyId": "6af4e9c8694a4300026ece71",
            "status": "APPROVED",
            "url": "https://celcoin.cadastro.io/5ab639ae1f725fda3cabdaf958b99763",
            "createdAt": "2026-11-11T19:18:41.511Z",
            "updateAt": "2026-11-11T19:21:49.515Z"
          }
        ]
      }
    ]
  },
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

**19:22:03 · GET `/baas/v2/account/fetch-business?documentNumber=************79` · HTTP 200 · 2074 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pj-1794435513260-29b3ce0e`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "body": {
    "statusAccount": "ATIVO",
    "documentNumber": "************79",
    "clientCode": "lobank-pj-1794435513260-29b3ce0e",
    "businessPhoneNumber": "*********4571",
    "businessEmail": "qa***@example.com",
    "createDate": "2026-11-11T19:21:51",
    "businessName": "QA H. T. L.",
    "tradingName": "QA H.",
    "owners": [
      {
        "documentNumber": "*********69",
        "phoneNumber": "*********4581",
        "email": "ca***@example.com",
        "fullName": "Carlos Q. R.",
        "socialName": null,
        "birthDate": "**-**-1988",
        "motherName": "Helena Q. T.",
        "address": {
          "postalCode": "***",
          "street": "***",
          "number": "***",
          "addressComplement": null,
          "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
          "city": "Barueri",
          "state": "SP",
          "longitude": null,
          "latitude": null
        },
        "isPoliticallyExposedPerson": false
      }
    ],
    "businessAccount": {
      "branch": "0001",
      "account": "*****639"
    },
    "businessAddress": {
      "postalCode": "***",
      "street": "***",
      "number": "***",
      "addressComplement": null,
      "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
      "city": "Barueri",
      "state": "SP",
      "longitude": null,
      "latitude": null
    }
  },
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

### Pedido ae7cdb718eea (19:22:03)

**19:22:03 · GET `/onboarding/v1/onboarding-proposal?proposalId=f2176523-ff9d-4b78-9353-049c2b64e46d` · HTTP 200 · 163 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "body": {
    "limit": 200,
    "currentPage": 1,
    "limitPerPage": 200,
    "totalPages": 1,
    "totalItems": 1,
    "proposal": [
      {
        "proposalId": "f2176523-ff9d-4b78-9353-049c2b64e46d",
        "clientCode": "lobank-pf-1794435480705-54b4e55e",
        "documentNumber": "*********05",
        "status": "RESOURCE_CREATED",
        "proposalType": "PF",
        "createdAt": "2026-11-11T19:18:11.479Z",
        "updatedAt": "2026-11-11T19:20:59.175Z",
        "documentscopys": [
          {
            "proposalId": "f2176523-ff9d-4b78-9353-049c2b64e46d",
            "documentNumber": "*********05",
            "documentscopyId": "6af4e9aa73a26b0002c478e2",
            "status": "APPROVED",
            "url": "https://celcoin.cadastro.io/b985eb2d79f894e3e6130a747e02db26",
            "createdAt": "2026-11-11T19:18:10.789Z",
            "updateAt": "2026-11-11T19:20:48.614Z"
          }
        ]
      }
    ]
  },
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

**19:22:04 · GET `/baas/v2/account/fetch?documentNumber=*********05` · HTTP 200 · 1092 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pf-1794435480705-54b4e55e`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "body": {
    "statusAccount": "ATIVO",
    "documentNumber": "*********05",
    "phoneNumber": "*********4561",
    "email": "qa***@example.com",
    "clientCode": "lobank-pf-1794435480705-54b4e55e",
    "motherName": "Maria Q. T.",
    "fullName": "Teste Q. H. P.",
    "socialName": null,
    "birthDate": "**-**-1992",
    "address": {
      "postalCode": "***",
      "street": "***",
      "number": "***",
      "addressComplement": null,
      "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
      "city": "Barueri",
      "state": "SP",
      "longitude": null,
      "latitude": null
    },
    "isPoliticallyExposedPerson": false,
    "account": {
      "branch": "0001",
      "account": "*****621"
    },
    "createDate": "2026-11-11T19:20:53"
  },
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

## `POST /api/onboarding/pj`

### Pedido 994ce5b9df94 (19:18:39)

**19:18:39 · POST `/onboarding/v1/onboarding-proposal/legal-person` · HTTP 200 · 6479 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pj-1794435513260-29b3ce0e`, `proposalId`=`e6884ef4-026f-47be-9c51-f9e3b7a08404`

Requisição:

```json
{
  "clientCode": "lobank-pj-1794435513260-29b3ce0e",
  "contactNumber": "*********4571",
  "documentNumber": "************79",
  "businessEmail": "qa***@example.com",
  "businessName": "QA H. T. L.",
  "tradingName": "QA H.",
  "companyType": "PJ",
  "owner": [
    {
      "ownerType": "SOCIO",
      "documentNumber": "*********69",
      "fullName": "Carlos Q. R.",
      "phoneNumber": "*********4581",
      "email": "ca***@example.com",
      "motherName": "Helena Q. T.",
      "birthDate": "**-**-1988",
      "address": {
        "postalCode": "***",
        "street": "***",
        "number": "***",
        "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
        "city": "Barueri",
        "state": "SP"
      },
      "isPoliticallyExposedPerson": false
    }
  ],
  "businessAddress": {
    "postalCode": "***",
    "street": "***",
    "number": "***",
    "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
    "city": "Barueri",
    "state": "SP"
  },
  "onboardingType": "BAAS"
}
```

Resposta:

```json
{
  "body": {
    "proposalId": "e6884ef4-026f-47be-9c51-f9e3b7a08404",
    "clientCode": "lobank-pj-1794435513260-29b3ce0e",
    "documentNumber": "************79"
  },
  "version": "1.0.0",
  "status": "PROCESSING"
}
```

## `GET /api/balance`

### Pedido db68e6f2b10b (19:22:33)

**19:22:33 · GET `/baas/v2/wallet/balance?Account=*****621` · HTTP 200 · 872 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0",
  "body": {
    "amount": 100
  }
}
```

### Pedido bb8e99b03713 (19:24:19)

**19:24:19 · GET `/baas/v2/wallet/balance?Account=*****639` · HTTP 200 · 970 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0",
  "body": {
    "amount": 100
  }
}
```

### Pedido 7325905c2878 (19:29:06)

**19:29:06 · GET `/baas/v2/wallet/balance?Account=*****621` · HTTP 200 · 864 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0",
  "body": {
    "amount": 96
  }
}
```

### Pedido c51939d2c4a7 (19:29:07)

**19:29:07 · GET `/baas/v2/wallet/balance?Account=*****639` · HTTP 200 · 739 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0",
  "body": {
    "amount": 100
  }
}
```

## `GET /api/statement`

### Pedido ddb6be82fe71 (19:22:35)

**19:22:35 · GET `/baas/v2/wallet/power-movement?Account=*****621&DateFrom=2026-11-05&DateTo=2026-11-11&Page=1&LimitPerPage=100` · HTTP 200 · 1614 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "2.0.0",
  "totalItems": 1,
  "currentPage": 1,
  "limitPerPage": 100,
  "totalPages": 1,
  "dateFrom": "2026-11-05T00:00:00",
  "dateTo": "2026-11-11T23:59:59.9999999",
  "body": {
    "account": "*****621",
    "documentNumber": "*********05",
    "movements": [
      {
        "id": "652fce05-b74a-4a77-86ed-390836fc9650",
        "clientCode": "lobank-qa-credito-pf-20261111",
        "description": "Credito de teste QA homologacao",
        "createDate": "2026-11-11T19:22:13.879Z",
        "amount": 100,
        "status": "CONFIRMED",
        "balanceType": "CREDIT",
        "movementType": "ENTRYCREDIT",
        "additionalInformation": {
          "id": "652fce05-b74a-4a77-86ed-390836fc9650",
          "clientCode": "lobank-qa-credito-pf-20261111",
          "amount": 100,
          "branch": "0001",
          "oldBalance": 0,
          "currentBalance": 100,
          "description": "Credito de teste QA homologacao",
          "taxId": "*********05",
          "account": "*****621"
        }
      }
    ]
  }
}
```

### Pedido 147d0cead108 (19:24:21)

**19:24:21 · GET `/baas/v2/wallet/power-movement?Account=*****639&DateFrom=2026-11-05&DateTo=2026-11-11&Page=1&LimitPerPage=100` · HTTP 200 · 1387 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "2.0.0",
  "totalItems": 1,
  "currentPage": 1,
  "limitPerPage": 100,
  "totalPages": 1,
  "dateFrom": "2026-11-05T00:00:00",
  "dateTo": "2026-11-11T23:59:59.9999999",
  "body": {
    "account": "*****639",
    "documentNumber": "************79",
    "movements": [
      {
        "id": "3c09cdf1-2ac9-4db0-a256-e1253ce2b789",
        "clientCode": "lobank-qa-credito-pj-20261111",
        "description": "Credito de teste QA homologacao",
        "createDate": "2026-11-11T19:22:18.15Z",
        "amount": 100,
        "status": "CONFIRMED",
        "balanceType": "CREDIT",
        "movementType": "ENTRYCREDIT",
        "additionalInformation": {
          "id": "3c09cdf1-2ac9-4db0-a256-e1253ce2b789",
          "clientCode": "lobank-qa-credito-pj-20261111",
          "amount": 100,
          "branch": "0001",
          "oldBalance": 0,
          "currentBalance": 100,
          "description": "Credito de teste QA homologacao",
          "taxId": "************79",
          "account": "*****639"
        }
      }
    ]
  }
}
```

## `PUT /api/me`

### Pedido 8b923b40bd66 (19:22:37)

**19:22:37 · PUT `/baas/v2/account/natural-person?Account=*****621&DocumentNumber=*********05` · HTTP 200 · 2102 ms · modo sandbox**

Requisição:

```json
{
  "phoneNumber": "*********4562",
  "email": "qa***@example.com",
  "isPoliticallyExposedPerson": false,
  "address": {
    "postalCode": "***",
    "street": "***",
    "number": "***",
    "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
    "city": "Barueri",
    "state": "SP"
  }
}
```

Resposta:

```json
{
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

### Pedido 903cab2fba05 (19:24:23)

**19:24:23 · GET `/baas/v2/account/fetch-business?documentNumber=************79` · HTTP 200 · 1618 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pj-1794435513260-29b3ce0e`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "body": {
    "statusAccount": "ATIVO",
    "documentNumber": "************79",
    "clientCode": "lobank-pj-1794435513260-29b3ce0e",
    "businessPhoneNumber": "*********4571",
    "businessEmail": "qa***@example.com",
    "createDate": "2026-11-11T19:21:51",
    "businessName": "QA H. T. L.",
    "tradingName": "QA H.",
    "owners": [
      {
        "documentNumber": "*********69",
        "phoneNumber": "*********4581",
        "email": "ca***@example.com",
        "fullName": "Carlos Q. R.",
        "socialName": null,
        "birthDate": "**-**-1988",
        "motherName": "Helena Q. T.",
        "address": {
          "postalCode": "***",
          "street": "***",
          "number": "***",
          "addressComplement": null,
          "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
          "city": "Barueri",
          "state": "SP",
          "longitude": null,
          "latitude": null
        },
        "isPoliticallyExposedPerson": false
      }
    ],
    "businessAccount": {
      "branch": "0001",
      "account": "*****639"
    },
    "businessAddress": {
      "postalCode": "***",
      "street": "***",
      "number": "***",
      "addressComplement": null,
      "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
      "city": "Barueri",
      "state": "SP",
      "longitude": null,
      "latitude": null
    }
  },
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

**19:24:25 · PUT `/baas/v2/account/business?Account=*****639&DocumentNumber=************79` · HTTP 200 · 2608 ms · modo sandbox**

Requisição:

```json
{
  "businessEmail": "qa***@example.com",
  "contactNumber": "*********4572",
  "documentNumber": "************79",
  "businessName": "QA H. T. L.",
  "tradeName": "QA H.",
  "owners": [
    {
      "documentNumber": "*********69",
      "fullName": "Carlos Q. R.",
      "phoneNumber": "*********4581",
      "email": "ca***@example.com",
      "motherName": "Helena Q. T.",
      "birthDate": "**-**-1988",
      "address": {
        "postalCode": "***",
        "street": "***",
        "number": "***",
        "addressComplement": null,
        "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
        "city": "Barueri",
        "state": "SP",
        "longitude": null,
        "latitude": null
      },
      "isPoliticallyExposedPerson": false
    }
  ],
  "businessAddress": {
    "postalCode": "***",
    "street": "***",
    "number": "***",
    "neighborhood": "Alphaville Centro Industrial e Empresarial/Alphaville.",
    "city": "Barueri",
    "state": "SP"
  }
}
```

Resposta:

```json
{
  "version": "1.0.0",
  "status": "SUCCESS"
}
```

## `GET /api/pix/keys`

### Pedido f451e8f54293 (19:22:49)

**19:22:49 · GET `/baas/v2/pix/dict/entry/*****621` · HTTP 404 · 1597 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "ERROR",
  "error": {
    "errorCode": "CBE180",
    "message": "Não encontramos a chave informada."
  },
  "version": "1.0.0"
}
```

### Pedido 34f27c2215d9 (19:25:28)

**19:25:28 · GET `/baas/v2/pix/dict/entry/*****621` · HTTP 200 · 867 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "body": {
    "listKeys": [
      {
        "keyType": "EVP",
        "key": "87971de6-****-****-****-455f",
        "account": {
          "participant": "13935893",
          "branch": "0001",
          "account": "*****621",
          "accountType": "TRAN",
          "createDate": "2026-11-11T19:22:51Z"
        },
        "owner": {
          "type": "NATURAL_PERSON",
          "documentNumber": "*********05",
          "name": "Teste Q. H. P."
        }
      }
    ]
  },
  "version": "1.0.0"
}
```

## `POST /api/pix/keys/evp`

### Pedido d4f7a465dda4 (19:22:54)

**19:22:54 · POST `/baas/v2/pix/dict/entry` · HTTP 200 · 4911 ms · modo sandbox**

Requisição:

```json
{
  "account": "*****621",
  "keyType": "EVP"
}
```

Resposta:

```json
{
  "status": "CONFIRMED",
  "body": {
    "keyType": "EVP",
    "key": "87971de6-****-****-****-455f",
    "account": {
      "participant": "13935893",
      "branch": "0001",
      "account": "*****621",
      "accountType": "TRAN",
      "createDate": "2026-11-11T19:22:51Z"
    },
    "owner": {
      "type": "NATURAL_PERSON",
      "documentNumber": "*********05",
      "name": "Teste Q. H. P."
    }
  },
  "version": "1.0.0"
}
```

**19:22:55 · GET `/baas/v2/pix/dict/entry/*****621` · HTTP 200 · 979 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "body": {
    "listKeys": [
      {
        "keyType": "EVP",
        "key": "87971de6-****-****-****-455f",
        "account": {
          "participant": "13935893",
          "branch": "0001",
          "account": "*****621",
          "accountType": "TRAN",
          "createDate": "2026-11-11T19:22:51Z"
        },
        "owner": {
          "type": "NATURAL_PERSON",
          "documentNumber": "*********05",
          "name": "Teste Q. H. P."
        }
      }
    ]
  },
  "version": "1.0.0"
}
```

### Pedido bf261ade3138 (19:24:26)

**19:24:26 · GET `/baas/v2/pix/dict/entry/*****639` · HTTP 404 · 863 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "ERROR",
  "error": {
    "errorCode": "CBE180",
    "message": "Não encontramos a chave informada."
  },
  "version": "1.0.0"
}
```

**19:24:30 · POST `/baas/v2/pix/dict/entry` · HTTP 200 · 4023 ms · modo sandbox**

Requisição:

```json
{
  "account": "*****639",
  "keyType": "EVP"
}
```

Resposta:

```json
{
  "status": "CONFIRMED",
  "body": {
    "keyType": "EVP",
    "key": "d5256803-****-****-****-dff2",
    "account": {
      "participant": "13935893",
      "branch": "0001",
      "account": "*****639",
      "accountType": "TRAN",
      "createDate": "2026-11-11T19:24:27Z"
    },
    "owner": {
      "type": "LEGAL_PERSON",
      "documentNumber": "************79",
      "name": "QA H. T. L."
    }
  },
  "version": "1.0.0"
}
```

**19:24:32 · GET `/baas/v2/pix/dict/entry/*****639` · HTTP 200 · 1520 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "body": {
    "listKeys": [
      {
        "keyType": "EVP",
        "key": "d5256803-****-****-****-dff2",
        "account": {
          "participant": "13935893",
          "branch": "0001",
          "account": "*****639",
          "accountType": "TRAN",
          "createDate": "2026-11-11T19:24:27Z"
        },
        "owner": {
          "type": "LEGAL_PERSON",
          "documentNumber": "************79",
          "name": "QA H. T. L."
        }
      }
    ]
  },
  "version": "1.0.0"
}
```

## `POST /api/pix/lookup`

### Pedido 37a0f305c718 (19:22:56)

**19:22:56 · GET `/baas/v2/pix/dict/entry/external/*****621?key=te***%40celcoin.com.br` · HTTP 200 · 1505 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "body": {
    "keyType": "EMAIL",
    "key": "te***@celcoin.com.br",
    "account": {
      "participant": "13935893",
      "branch": "0",
      "account": "*********",
      "accountType": "***"
    },
    "owner": {
      "type": "LEGAL_PERSON",
      "documentNumber": "************30",
      "name": "Pix C. T. 2. A.",
      "tradeName": "Pix C. T. 2. A."
    },
    "endtoEndId": "E13935893202611112222P33ISOTi0Bg",
    "isSameTaxId": false
  },
  "version": "1.0.0"
}
```

### Pedido 617c635072a0 (19:23:17)

**19:23:17 · GET `/baas/v2/pix/dict/entry/external/*****621?key=te***%40celcoin.com.br` · HTTP 200 · 1806 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "body": {
    "keyType": "EMAIL",
    "key": "te***@celcoin.com.br",
    "account": {
      "participant": "13935893",
      "branch": "0",
      "account": "**************",
      "accountType": "***"
    },
    "owner": {
      "type": "NATURAL_PERSON",
      "documentNumber": "****21",
      "name": "Margaret G."
    },
    "endtoEndId": "E13935893202611112223ueRgWSgzCt1",
    "isSameTaxId": false
  },
  "version": "1.0.0"
}
```

## `POST /api/pix/transfer`

### Pedido 180ce9b91117 (19:22:57)

**19:22:57 · GET `/baas/v2/wallet/balance?Account=*****621` · HTTP 200 · 738 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0",
  "body": {
    "amount": 100
  }
}
```

**19:23:00 · POST `/baas/v2/pix/payment` · HTTP 200 · 3447 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pix-1794435777321-76d8bd35`, `id`=`72e5cd32-0b65-4f37-b57e-a9b0c22bb014`, `endToEndId`=`E13935893202611112222P33ISOTi0Bg`

Requisição:

```json
{
  "amount": 1,
  "clientCode": "lobank-pix-1794435777321-76d8bd35",
  "endToEndId": "E13935893202611112222P33ISOTi0Bg",
  "paymentType": "IMMEDIATE",
  "urgency": "HIGH",
  "transactionType": "TRANSFER",
  "debitParty": {
    "account": "*****621",
    "branch": "0001",
    "taxId": "*********05",
    "name": "Teste Q. H. P.",
    "accountType": "TRAN",
    "bank": "13935893"
  },
  "initiationType": "DICT",
  "creditParty": {
    "bank": "13935893",
    "key": "te***@celcoin.com.br",
    "account": "*********",
    "branch": "0",
    "taxId": "************30",
    "name": "Pix C. T. 2. A.",
    "accountType": "***"
  },
  "remittanceInformation": "QA homologacao chave"
}
```

Resposta:

```json
{
  "status": "PROCESSING",
  "version": "1.0.0",
  "body": {
    "id": "72e5cd32-0b65-4f37-b57e-a9b0c22bb014",
    "amount": 1,
    "clientCode": "lobank-pix-1794435777321-76d8bd35",
    "transactionIdentification": null,
    "endToEndId": "E13935893202611112222P33ISOTi0Bg",
    "initiationType": "DICT",
    "paymentType": "IMMEDIATE",
    "urgency": "HIGH",
    "transactionType": "TRANSFER",
    "debitParty": {
      "account": "*****621",
      "branch": "0001",
      "taxId": "*********05",
      "name": "Teste Q. H. P.",
      "accountType": "TRAN"
    },
    "creditParty": {
      "bank": "13935893",
      "key": "te***@celcoin.com.br",
      "account": "*********",
      "branch": "0",
      "taxId": "************30",
      "name": "Pix C. T. 2. A.",
      "accountType": "TRAN"
    },
    "remittanceInformation": "QA homologacao chave",
    "recurrencyAccept": false,
    "taxIdPaymentInitiator": null,
    "vlcpAmount": null,
    "vldnAmount": null,
    "withdrawalServiceProvider": null,
    "withdrawalAgentMode": null
  }
}
```

### Pedido ae9548948074 (19:23:09)

**19:23:09 · GET `/baas/v2/wallet/balance?Account=*****621` · HTTP 200 · 742 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0",
  "body": {
    "amount": 99
  }
}
```

**19:23:15 · POST `/baas/v2/pix/payment` · HTTP 200 · 6227 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pix-1794435789466-10601384`, `id`=`ecef9b45-6a1e-43af-bf6e-4f87375c005a`, `endToEndId`=`E139358932026111122231P7FeOsuzRo`

Requisição:

```json
{
  "amount": 1,
  "clientCode": "lobank-pix-1794435789466-10601384",
  "initiationType": "MANUAL",
  "paymentType": "IMMEDIATE",
  "urgency": "HIGH",
  "transactionType": "TRANSFER",
  "debitParty": {
    "account": "*****621",
    "branch": "0001",
    "taxId": "*********05",
    "name": "Teste Q. H. P.",
    "accountType": "TRAN",
    "bank": "13935893"
  },
  "creditParty": {
    "bank": "13935893",
    "account": "******396",
    "branch": "0001",
    "taxId": "************30",
    "name": "Pix C. T. 2. A.",
    "accountType": "TRAN"
  },
  "remittanceInformation": "QA homologacao agencia e conta"
}
```

Resposta:

```json
{
  "status": "PROCESSING",
  "version": "1.0.0",
  "body": {
    "id": "ecef9b45-6a1e-43af-bf6e-4f87375c005a",
    "amount": 1,
    "clientCode": "lobank-pix-1794435789466-10601384",
    "transactionIdentification": null,
    "endToEndId": "E139358932026111122231P7FeOsuzRo",
    "initiationType": "MANUAL",
    "paymentType": "IMMEDIATE",
    "urgency": "HIGH",
    "transactionType": "TRANSFER",
    "debitParty": {
      "account": "*****621",
      "branch": "0001",
      "taxId": "*********05",
      "name": "Teste Q. H. P.",
      "accountType": "TRAN"
    },
    "creditParty": {
      "bank": "13935893",
      "key": null,
      "account": "******396",
      "branch": "0001",
      "taxId": "************30",
      "name": "Pix C. T. 2. A.",
      "accountType": "TRAN"
    },
    "remittanceInformation": "QA homologacao agencia e conta",
    "recurrencyAccept": false,
    "taxIdPaymentInitiator": null,
    "vlcpAmount": null,
    "vldnAmount": null,
    "withdrawalServiceProvider": null,
    "withdrawalAgentMode": null
  }
}
```

### Pedido 54e6aebd542c (19:23:19)

**19:23:19 · GET `/baas/v2/wallet/balance?Account=*****621` · HTTP 200 · 1595 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0",
  "body": {
    "amount": 98
  }
}
```

**19:23:22 · POST `/baas/v2/pix/payment` · HTTP 200 · 3345 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pix-1794435799161-2e12846c`, `id`=`407060be-ed39-4596-952a-a43ce5278dc0`, `endToEndId`=`E13935893202611112223ueRgWSgzCt1`

Requisição:

```json
{
  "amount": 1,
  "clientCode": "lobank-pix-1794435799161-2e12846c",
  "endToEndId": "E13935893202611112223ueRgWSgzCt1",
  "paymentType": "IMMEDIATE",
  "urgency": "HIGH",
  "transactionType": "TRANSFER",
  "debitParty": {
    "account": "*****621",
    "branch": "0001",
    "taxId": "*********05",
    "name": "Teste Q. H. P.",
    "accountType": "TRAN",
    "bank": "13935893"
  },
  "initiationType": "DICT",
  "creditParty": {
    "bank": "13935893",
    "key": "te***@celcoin.com.br",
    "account": "**************",
    "branch": "0",
    "taxId": "****21",
    "name": "Margaret G.",
    "accountType": "***"
  },
  "remittanceInformation": "QA homologacao rejeitado"
}
```

Resposta:

```json
{
  "status": "PROCESSING",
  "version": "1.0.0",
  "body": {
    "id": "407060be-ed39-4596-952a-a43ce5278dc0",
    "amount": 1,
    "clientCode": "lobank-pix-1794435799161-2e12846c",
    "transactionIdentification": null,
    "endToEndId": "E13935893202611112223ueRgWSgzCt1",
    "initiationType": "DICT",
    "paymentType": "IMMEDIATE",
    "urgency": "HIGH",
    "transactionType": "TRANSFER",
    "debitParty": {
      "account": "*****621",
      "branch": "0001",
      "taxId": "*********05",
      "name": "Teste Q. H. P.",
      "accountType": "TRAN"
    },
    "creditParty": {
      "bank": "13935893",
      "key": "te***@celcoin.com.br",
      "account": "**************",
      "branch": "0",
      "taxId": "****21",
      "name": "Margaret G.",
      "accountType": "TRAN"
    },
    "remittanceInformation": "QA homologacao rejeitado",
    "recurrencyAccept": false,
    "taxIdPaymentInitiator": null,
    "vlcpAmount": null,
    "vldnAmount": null,
    "withdrawalServiceProvider": null,
    "withdrawalAgentMode": null
  }
}
```

### Pedido 0b9c112c1a09 (19:24:44)

**19:24:44 · GET `/baas/v2/wallet/balance?Account=*****621` · HTTP 200 · 738 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0",
  "body": {
    "amount": 97
  }
}
```

**19:24:48 · POST `/baas/v2/pix/payment` · HTTP 200 · 4108 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pix-1794435884422-2b76f455`, `id`=`4dd10f16-b969-4107-98f7-225934a59123`, `endToEndId`=`E13935893202611112224tIXjRL8EQlZ`

Requisição:

```json
{
  "amount": 1,
  "clientCode": "lobank-pix-1794435884422-2b76f455",
  "endToEndId": "E13935893202611112224tIXjRL8EQlZ",
  "paymentType": "IMMEDIATE",
  "urgency": "HIGH",
  "transactionType": "TRANSFER",
  "debitParty": {
    "account": "*****621",
    "branch": "0001",
    "taxId": "*********05",
    "name": "Teste Q. H. P.",
    "accountType": "TRAN",
    "bank": "13935893"
  },
  "initiationType": "STATIC_QRCODE",
  "transactionIdentification": "***",
  "creditParty": {
    "bank": "13935893",
    "key": "d5256803-****-****-****-dff2",
    "account": "********",
    "branch": "0",
    "taxId": "************79",
    "name": "QA H. T. L.",
    "accountType": "***"
  }
}
```

Resposta:

```json
{
  "status": "PROCESSING",
  "version": "1.0.0",
  "body": {
    "id": "4dd10f16-b969-4107-98f7-225934a59123",
    "amount": 1,
    "clientCode": "lobank-pix-1794435884422-2b76f455",
    "transactionIdentification": "***",
    "endToEndId": "E13935893202611112224tIXjRL8EQlZ",
    "initiationType": "STATIC_QRCODE",
    "paymentType": "IMMEDIATE",
    "urgency": "HIGH",
    "transactionType": "TRANSFER",
    "debitParty": {
      "account": "*****621",
      "branch": "0001",
      "taxId": "*********05",
      "name": "Teste Q. H. P.",
      "accountType": "TRAN"
    },
    "creditParty": {
      "bank": "13935893",
      "key": "d5256803-****-****-****-dff2",
      "account": "********",
      "branch": "0",
      "taxId": "************79",
      "name": "QA H. T. L.",
      "accountType": "TRAN"
    },
    "remittanceInformation": null,
    "recurrencyAccept": false,
    "taxIdPaymentInitiator": null,
    "vlcpAmount": null,
    "vldnAmount": null,
    "withdrawalServiceProvider": null,
    "withdrawalAgentMode": null
  }
}
```

## `POST /api/pix/manual`

### Pedido 4421fafc81cc (19:23:08)

**19:23:08 · GET `/pix/v1/participants` · HTTP 200 · 314 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "cortado": true,
  "tamanhoOriginal": 172330,
  "itens": 887,
  "inicio": "[{\"date\":\"2026-11-11T00:00:06.209\",\"type\":\"IDRT\",\"name\":\"CENTRAL D. C. D. C. D. E. D. M. G. M. G. D. S. E. D. M. D. C. -. S. C. R.\",\"shortName\":\"CCC DOS EST DE MT, MS E MUN DE CACOAL/RO\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00106180\"},{\"date\":\"2026-11-11T00:00:06.211\",\"type\":\"DRCT\",\"name\":\"COOPERATIVA C. D. C. U. D. B. -. U. D. B.\",\"shortName\":\"UNICRED DO BRASIL\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00315557\"},{\"date\":\"2026-11-11T00:00:06.211\",\"type\":\"DRCT\",\"name\":\"CAIXA E. F.\",\"shortName\":\"CAIXA ECONOMICA FEDERAL\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00360305\"},{\"date\":\"2026-11-11T00:00:06.213\",\"type\":\"IDRT\",\"name\":\"ASSOCIACAO D. P. E. E. -. P.\",\"shortName\":\"APE POUPEX\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00655522\"},{\"date\":\"2026-11-11T00:00:06.213\",\"type\":\"IDRT\",\"name\":\"COOPERATIVA D. C. D. L. A. D. A. -. S. C. S.\",\"shortName\":\"CCLA SICOOB CREDICARU SC/RS\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00694389\"},{\"date\":\"2026-11-11T00:00:06.213\",\"type\":\"IDRT\",\"name\":\"COOPERATIVA D. C. D. L. A. D. B. C. L. -. S. E.\",\"shortName\":\"COOP SICOOB EXECUTIVO LTDA.\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00694877\"},{\"date\":\"2026-11-11T00:00:06.213\",\"type\":\"IDRT\",\"name\":\"COOPERATIVA D. C. V. D. C. -. S. C.\",\"shortName\":\"CC VALE DO CANOAS\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00707903\"},{\"date\":\"2026-11-11T00:00:06.213\",\"type\":\"DRCT\",\"name\":\"BANCO S. S.\",\"shortName\":\"BANCO SEMEAR\",\"startOperationDatetime\":\"2021-12-22T07:00:00\",\"ispb\":\"00795423\"},{\"date\":\"2026-11-11T00:00:06.213\",\"type\":\"IDRT\",\"name\":\"COOPERATIVA D. C. D. L. A. D. B. E. L. -. S. B.\",\"shortName\":\"CCLA BOA ESPERANÇA\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00869687\"},{\"date\":\"2026-11-11T00:00:06.215\",\"type\":\"IDRT\",\"name\":\"COOPERATIVA D. C. D. L. A. C. L. -. S. C.\",\"shortName\":\"SICOOB CREDFAZ\",\"startOperationDatetime\":\"2020-11-03T03:30:00\",\"ispb\":\"00952415\"},{\"date\":\"2026-11-11T00:00:"
}
```

## `GET /api/pix/transfer/:id`

### Pedido 8e83252f49c3 (19:24:06)

**19:24:06 · GET `/baas/v2/pix/payment/status?id=72e5cd32-0b65-4f37-b57e-a9b0c22bb014` · HTTP 200 · 1071 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pix-1794435777321-76d8bd35`, `id`=`72e5cd32-0b65-4f37-b57e-a9b0c22bb014`, `endToEndId`=`E13935893202611112222P33ISOTi0Bg`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "CONFIRMED",
  "version": "1.0.0",
  "body": {
    "id": "72e5cd32-0b65-4f37-b57e-a9b0c22bb014",
    "amount": 1,
    "clientCode": "lobank-pix-1794435777321-76d8bd35",
    "endToEndId": "E13935893202611112222P33ISOTi0Bg",
    "initiationType": "DICT",
    "paymentType": "IMMEDIATE",
    "urgency": "HIGH",
    "transactionType": "TRANSFER",
    "debitParty": {
      "account": "*****621",
      "branch": "0001",
      "taxId": "*********05",
      "name": "Teste Q. H. P.",
      "accountType": "TRAN",
      "bank": null
    },
    "creditParty": {
      "bank": "13935893",
      "key": "te***@celcoin.com.br",
      "account": "******396",
      "branch": "0001",
      "taxId": "************30",
      "name": "Pix C. T. 2. A.",
      "accountType": "TRAN"
    },
    "remittanceInformation": "QA homologacao chave"
  }
}
```

### Pedido 389b5ef1f5ed (19:24:08)

**19:24:08 · GET `/baas/v2/pix/payment/status?id=ecef9b45-6a1e-43af-bf6e-4f87375c005a` · HTTP 200 · 1302 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pix-1794435789466-10601384`, `id`=`ecef9b45-6a1e-43af-bf6e-4f87375c005a`, `endToEndId`=`E139358932026111122231P7FeOsuzRo`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "CONFIRMED",
  "version": "1.0.0",
  "body": {
    "id": "ecef9b45-6a1e-43af-bf6e-4f87375c005a",
    "amount": 1,
    "clientCode": "lobank-pix-1794435789466-10601384",
    "endToEndId": "E139358932026111122231P7FeOsuzRo",
    "initiationType": "MANUAL",
    "paymentType": "IMMEDIATE",
    "urgency": "HIGH",
    "transactionType": "TRANSFER",
    "debitParty": {
      "account": "*****621",
      "branch": "0001",
      "taxId": "*********05",
      "name": "Teste Q. H. P.",
      "accountType": "TRAN",
      "bank": null
    },
    "creditParty": {
      "bank": "13935893",
      "key": null,
      "account": "******396",
      "branch": "0001",
      "taxId": "************30",
      "name": "Pix C. T. 2. A.",
      "accountType": "TRAN"
    },
    "remittanceInformation": "QA homologacao agencia e conta"
  }
}
```

### Pedido c6397d42610d (19:24:09)

**19:24:09 · GET `/baas/v2/pix/payment/status?id=407060be-ed39-4596-952a-a43ce5278dc0` · HTTP 200 · 935 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pix-1794435799161-2e12846c`, `id`=`407060be-ed39-4596-952a-a43ce5278dc0`, `endToEndId`=`E13935893202611112223ueRgWSgzCt1`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "CONFIRMED",
  "version": "1.0.0",
  "body": {
    "id": "407060be-ed39-4596-952a-a43ce5278dc0",
    "amount": 1,
    "clientCode": "lobank-pix-1794435799161-2e12846c",
    "endToEndId": "E13935893202611112223ueRgWSgzCt1",
    "initiationType": "DICT",
    "paymentType": "IMMEDIATE",
    "urgency": "HIGH",
    "transactionType": "TRANSFER",
    "debitParty": {
      "account": "*****621",
      "branch": "0001",
      "taxId": "*********05",
      "name": "Teste Q. H. P.",
      "accountType": "TRAN",
      "bank": null
    },
    "creditParty": {
      "bank": "13935893",
      "key": "te***@celcoin.com.br",
      "account": "***********934",
      "branch": "0001",
      "taxId": "*********25",
      "name": "Margaret G.",
      "accountType": "TRAN"
    },
    "remittanceInformation": "QA homologacao rejeitado"
  }
}
```

### Pedido a6ba23dba43c (19:25:27)

**19:25:27 · GET `/baas/v2/pix/payment/status?id=4dd10f16-b969-4107-98f7-225934a59123` · HTTP 200 · 1069 ms · modo sandbox**

Correlação: `clientCode`=`lobank-pix-1794435884422-2b76f455`, `id`=`4dd10f16-b969-4107-98f7-225934a59123`, `endToEndId`=`E13935893202611112224tIXjRL8EQlZ`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "CONFIRMED",
  "version": "1.0.0",
  "body": {
    "id": "4dd10f16-b969-4107-98f7-225934a59123",
    "amount": 1,
    "clientCode": "lobank-pix-1794435884422-2b76f455",
    "transactionIdentification": "***",
    "endToEndId": "E13935893202611112224tIXjRL8EQlZ",
    "initiationType": "STATIC_QRCODE",
    "paymentType": "IMMEDIATE",
    "urgency": "HIGH",
    "transactionType": "TRANSFER",
    "debitParty": {
      "account": "*****621",
      "branch": "0001",
      "taxId": "*********05",
      "name": "Teste Q. H. P.",
      "accountType": "TRAN",
      "bank": null
    },
    "creditParty": {
      "bank": "13935893",
      "key": "d5256803-****-****-****-dff2",
      "account": "*****639",
      "branch": "0001",
      "taxId": "************79",
      "name": "QA H. T. L.",
      "accountType": "TRAN"
    }
  }
}
```

## `POST /api/pix/qrcode`

### Pedido 404d12c555a2 (19:24:32)

**19:24:32 · POST `/pix/v1/brcode/static` · HTTP 200 · 920 ms · modo sandbox**

Correlação: `transactionId`=`40000049837`

Requisição:

```json
{
  "key": "d5256803-****-****-****-dff2",
  "merchant": {
    "postalCode": "***",
    "city": "Barueri",
    "merchantCategoryCode": "0000",
    "name": "QA H. T. L."
  },
  "amount": 1
}
```

Resposta:

```json
{
  "transactionId": 40000049837,
  "emvqrcps": "000201265800…[167 caracteres]",
  "transactionIdentification": "***",
  "recurrency": null
}
```

## `POST /api/pix/emv`

### Pedido 2d01d1e53476 (19:24:40)

**19:24:40 · POST `/pix/v1/emv/full` · HTTP 200 · 1091 ms · modo sandbox**

Requisição:

```json
{
  "emv": "000201265800…[167 caracteres]"
}
```

Resposta:

```json
{
  "version": "1.0.0",
  "status": 200,
  "body": {
    "type": "STATIC",
    "merchantAccountInformation": {
      "url": null,
      "gui": null,
      "merchantCategoryCode": "0000",
      "additionaldata": null,
      "withdrawalServiceProvider": null,
      "merchantName": null,
      "merchantCity": "Barueri",
      "postalCode": "***"
    },
    "key": "d5256803-****-****-****-dff2",
    "amount": {
      "original": 1,
      "abatement": null,
      "discount": null,
      "interest": null,
      "final": 1,
      "fine": null,
      "canModifyFinalAmount": false,
      "withdrawal": null,
      "change": null
    },
    "transactionIdentification": "***",
    "payload": null
  }
}
```

**19:24:43 · GET `/baas/v2/pix/dict/entry/external/*****621?key=d5256803-****-****-****-dff2` · HTTP 200 · 2936 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "body": {
    "keyType": "EVP",
    "key": "d5256803-****-****-****-dff2",
    "account": {
      "participant": "13935893",
      "branch": "0",
      "account": "********",
      "accountType": "***"
    },
    "owner": {
      "type": "LEGAL_PERSON",
      "documentNumber": "************79",
      "name": "QA H. T. L."
    },
    "endtoEndId": "E13935893202611112224tIXjRL8EQlZ",
    "isSameTaxId": false
  },
  "version": "1.0.0"
}
```

## `POST /api/dda/subscribe`

### Pedido c4422aa5b4ac (19:25:30)

**19:25:30 · POST `/dda-subscription-webservice/v1/subscription/Register` · HTTP 201 · 1105 ms · modo sandbox**

Correlação: `clientRequestId`=`lobank-dda-1794435929199-87cdf925`

Requisição:

```json
{
  "document": "*********05",
  "clientName": "Teste Q. H. P.",
  "clientRequestId": "lobank-dda-1794435929199-87cdf925"
}
```

Resposta:

```json
{
  "status": 201,
  "body": {
    "document": "*********05",
    "clientRequestId": "lobank-dda-1794435929199-87cdf925",
    "responseDate": "2026-11-11T22:25:30.6369446+00:00",
    "status": "PROCESSING",
    "subscriptionId": "fd461fee-8d00-4fba-abc9-69c7d3d2df89"
  }
}
```

## `DELETE /api/pix/keys/:chave`

### Pedido 8ef456df2a04 (19:26:41)

**19:26:41 · GET `/baas/v2/pix/dict/entry/*****621` · HTTP 200 · 1038 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "body": {
    "listKeys": [
      {
        "keyType": "EVP",
        "key": "87971de6-****-****-****-455f",
        "account": {
          "participant": "13935893",
          "branch": "0001",
          "account": "*****621",
          "accountType": "TRAN",
          "createDate": "2026-11-11T19:22:51Z"
        },
        "owner": {
          "type": "NATURAL_PERSON",
          "documentNumber": "*********05",
          "name": "Teste Q. H. P."
        }
      }
    ]
  },
  "version": "1.0.0"
}
```

**19:26:44 · DELETE `/baas/v2/pix/dict/entry/87971de6-****-****-****-455f` · HTTP 200 · 2820 ms · modo sandbox**

Requisição:

```json
{
  "account": "*****621"
}
```

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0"
}
```

**19:26:45 · GET `/baas/v2/pix/dict/entry/*****621` · HTTP 404 · 864 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "ERROR",
  "error": {
    "errorCode": "CBE180",
    "message": "Não encontramos a chave informada."
  },
  "version": "1.0.0"
}
```

### Pedido b9973ea41ec6 (19:29:08)

**19:29:08 · GET `/baas/v2/pix/dict/entry/*****639` · HTTP 200 · 1381 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "SUCCESS",
  "body": {
    "listKeys": [
      {
        "keyType": "EVP",
        "key": "d5256803-****-****-****-dff2",
        "account": {
          "participant": "13935893",
          "branch": "0001",
          "account": "*****639",
          "accountType": "TRAN",
          "createDate": "2026-11-11T19:24:27Z"
        },
        "owner": {
          "type": "LEGAL_PERSON",
          "documentNumber": "************79",
          "name": "QA H. T. L."
        }
      }
    ]
  },
  "version": "1.0.0"
}
```

**19:29:10 · DELETE `/baas/v2/pix/dict/entry/d5256803-****-****-****-dff2` · HTTP 200 · 2155 ms · modo sandbox**

Requisição:

```json
{
  "account": "*****639"
}
```

Resposta:

```json
{
  "status": "SUCCESS",
  "version": "1.0.0"
}
```

**19:29:11 · GET `/baas/v2/pix/dict/entry/*****639` · HTTP 404 · 855 ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "status": "ERROR",
  "error": {
    "errorCode": "CBE180",
    "message": "Não encontramos a chave informada."
  },
  "version": "1.0.0"
}
```

## `GET /api/dda`

### Pedido b174ca82194d (19:26:46)

**19:26:46 · WEBHOOK `aviso do DDA recebido (SUBSCRIPTION) via webhook.site` · HTTP 200 · ? ms · modo sandbox**

Correlação: `clientRequestId`=`lobank-dda-1794435929199-87cdf925`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "recebidoEm": "2026-11-11 22:26:34",
  "idDoAviso": "be2285a2-52e2-49e4-8a82-c7468fa68a74",
  "body": {
    "document": "*********05",
    "clientRequestId": "lobank-dda-1794435929199-87cdf925",
    "subscriptionId": "fd461fee-8d00-4fba-abc9-69c7d3d2df89",
    "clientName": "Teste Q. H. P.",
    "status": "Created",
    "error": null
  }
}
```

### Pedido daeae5ede6dd (19:27:46)

**19:27:46 · WEBHOOK `aviso do DDA recebido (INVOICE) via webhook.site` · HTTP 200 · ? ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "recebidoEm": "2026-11-11 22:26:57",
  "idDoAviso": "d4ab4e27-f81f-4cf0-8735-a67caaa102d7",
  "body": {
    "registerData": {
      "addresseeBank": {
        "assignor": "",
        "ispb": 89005549,
        "code": "213"
      },
      "originalBeneficiary": {
        "personType": "F",
        "documentNumber": "*********12",
        "name": "Beneficiario O.",
        "fantasyName": "Beneficiario O."
      },
      "payer": {
        "personType": "F",
        "documentNumber": "*********05",
        "name": "Teste Q. H. P.",
        "fantasyName": "Teste Q. H. P."
      },
      "dueDate": "2026-11-12T00:00:00",
      "dueDateRegister": "2026-11-11T19:26:53.2195541",
      "hasDiscount": true,
      "hasInterest": true,
      "description": "Fixed DueDate",
      "originalValue": 47158,
      "digitable": "375944476103053942484325781432429106306065063878",
      "barCode": "37591063060650638784447630539424842578143242",
      "status": "Aberto",
      "paymentSituation": "Boleto de pagamento encontrado na base centralizada e cliente beneficiário apto",
      "transactionId": "1b388fff-f139-4131-8f46-d485ecbb1b6e",
      "pactualId": null,
      "ourNumber": "02970499004995463216",
      "typeCalcModel": null,
      "speciesCode": "2",
      "overdueDate": "2026-11-12T00:00:00",
      "paymentType": 3,
      "blockedPayment": false,
      "partialPayment": false,
      "allowanceAmount": 0,
      "interest": {
        "date": "2026-11-11T00:00:00",
        "code": "1",
        "description": "Value (Calendar days)",
        "amount": 95
      },
      "partial": {
        "installmentNumber": 0,
        "installmentTotalQuantity": 0,
        "partialPaymentQuantity": 0,
        "paymentBalanceAmount": 0,
        "paymentDescription": null
      },
      "fine": {
        "date": "2026-11-12T00:00:00",
        "code": "2",
        "description": "Percentage",
        "amount": 200
      },
      "discounts": [
        {
          "date": null,
          "code": "0",
          "description": "Exempt",
          "amount": 0
        }
      ],
      "calculatedAmount": 47158,
      "negociatedTitle": false,
      "recipientFinal": {
        "idType": 89258394,
        "id": "391",
        "name": "Guarantor D."
      },
      "limitAmounts": {
        "minAmountPercentType": "",
        "minAmountPercent": 0,
        "maxAmountPercentType": "",
        "maxAmountPercent": 0
      }
    }
  }
}
```

**19:27:46 · WEBHOOK `aviso do DDA recebido (INVOICE) via webhook.site` · HTTP 200 · ? ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "recebidoEm": "2026-11-11 22:26:56",
  "idDoAviso": "e139871d-36dc-41d4-974a-cb09ed2ab96c",
  "body": {
    "registerData": {
      "addresseeBank": {
        "assignor": "",
        "ispb": 28922248,
        "code": "104"
      },
      "originalBeneficiary": {
        "personType": "F",
        "documentNumber": "*********52",
        "name": "Beneficiario O.",
        "fantasyName": "Beneficiario O."
      },
      "payer": {
        "personType": "F",
        "documentNumber": "*********05",
        "name": "Teste Q. H. P.",
        "fantasyName": "Teste Q. H. P."
      },
      "dueDate": "2026-11-12T00:00:00",
      "dueDateRegister": "2026-11-11T19:26:53.2195425",
      "hasDiscount": true,
      "hasInterest": true,
      "description": "Fixed DueDate",
      "originalValue": 8069,
      "digitable": "49398695897843642881348477187529606305031331200",
      "barCode": "49396063050313312008695878436428814847718752",
      "status": "Aberto",
      "paymentSituation": "Boleto de pagamento encontrado na base centralizada e cliente beneficiário apto",
      "transactionId": "68668d7e-e07a-42cc-822b-d2fee12887db",
      "pactualId": null,
      "ourNumber": "02763123613517666973",
      "typeCalcModel": null,
      "speciesCode": "2",
      "overdueDate": "2026-11-12T00:00:00",
      "paymentType": 3,
      "blockedPayment": false,
      "partialPayment": false,
      "allowanceAmount": 0,
      "interest": {
        "date": "2026-11-11T00:00:00",
        "code": "1",
        "description": "Value (Calendar days)",
        "amount": 95
      },
      "partial": {
        "installmentNumber": 0,
        "installmentTotalQuantity": 0,
        "partialPaymentQuantity": 0,
        "paymentBalanceAmount": 0,
        "paymentDescription": null
      },
      "fine": {
        "date": "2026-11-12T00:00:00",
        "code": "2",
        "description": "Percentage",
        "amount": 200
      },
      "discounts": [
        {
          "date": null,
          "code": "0",
          "description": "Exempt",
          "amount": 0
        }
      ],
      "calculatedAmount": 8069,
      "negociatedTitle": false,
      "recipientFinal": {
        "idType": 58142036,
        "id": "209",
        "name": "Guarantor D."
      },
      "limitAmounts": {
        "minAmountPercentType": "",
        "minAmountPercent": 0,
        "maxAmountPercentType": "",
        "maxAmountPercent": 0
      }
    }
  }
}
```

**19:27:46 · WEBHOOK `aviso do DDA recebido (INVOICE) via webhook.site` · HTTP 200 · ? ms · modo sandbox**

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "recebidoEm": "2026-11-11 22:26:55",
  "idDoAviso": "241d9499-ed92-4773-80f2-ae94aa1f3637",
  "body": {
    "registerData": {
      "addresseeBank": {
        "assignor": "",
        "ispb": 46727736,
        "code": "9"
      },
      "originalBeneficiary": {
        "personType": "F",
        "documentNumber": "*********25",
        "name": "Beneficiario O.",
        "fantasyName": "Beneficiario O."
      },
      "payer": {
        "personType": "F",
        "documentNumber": "*********05",
        "name": "Teste Q. H. P.",
        "fantasyName": "Teste Q. H. P."
      },
      "dueDate": "2026-11-12T00:00:00",
      "dueDateRegister": "2026-11-11T19:26:53.2195271",
      "hasDiscount": true,
      "hasInterest": true,
      "description": "Fixed DueDate",
      "originalValue": 55864,
      "digitable": "50398677655474971783858700752734106304637310215",
      "barCode": "50391063046373102158677654749717835870075273",
      "status": "Aberto",
      "paymentSituation": "Boleto de pagamento encontrado na base centralizada e cliente beneficiário apto",
      "transactionId": "951573fe-4342-40e5-9457-1df00801b7bd",
      "pactualId": null,
      "ourNumber": "07955436433673196797",
      "typeCalcModel": null,
      "speciesCode": "2",
      "overdueDate": "2026-11-12T00:00:00",
      "paymentType": 3,
      "blockedPayment": false,
      "partialPayment": false,
      "allowanceAmount": 0,
      "interest": {
        "date": "2026-11-11T00:00:00",
        "code": "1",
        "description": "Value (Calendar days)",
        "amount": 95
      },
      "partial": {
        "installmentNumber": 0,
        "installmentTotalQuantity": 0,
        "partialPaymentQuantity": 0,
        "paymentBalanceAmount": 0,
        "paymentDescription": null
      },
      "fine": {
        "date": "2026-11-12T00:00:00",
        "code": "2",
        "description": "Percentage",
        "amount": 200
      },
      "discounts": [
        {
          "date": null,
          "code": "0",
          "description": "Exempt",
          "amount": 0
        }
      ],
      "calculatedAmount": 55864,
      "negociatedTitle": false,
      "recipientFinal": {
        "idType": 99050914,
        "id": "356",
        "name": "Guarantor D."
      },
      "limitAmounts": {
        "minAmountPercentType": "",
        "minAmountPercent": 0,
        "maxAmountPercentType": "",
        "maxAmountPercent": 0
      }
    }
  }
}
```

### Pedido 33a8c175eb0f (19:30:17)

**19:30:17 · WEBHOOK `aviso do DDA recebido (DELETION) via webhook.site` · HTTP 200 · ? ms · modo sandbox**

Correlação: `clientRequestId`=`lobank-dda-saida-1794436089711-fa9734c4`

Requisição:

_(sem corpo)_

Resposta:

```json
{
  "recebidoEm": "2026-11-11 22:29:25",
  "idDoAviso": "33cb01e5-2491-48a2-843b-5a901e2db571",
  "body": {
    "document": "*********05",
    "clientRequestId": "lobank-dda-saida-1794436089711-fa9734c4",
    "subscriptionId": "fd461fee-8d00-4fba-abc9-69c7d3d2df89",
    "clientName": "Teste Q. H. P.",
    "status": "Inactive",
    "error": null
  }
}
```

## `POST /api/dda/test-invoices`

### Pedido 996811c0ddcc (19:26:52)

**19:26:52 · POST `/dda-serviceinvoice-webservice/v1/invoice/register` · HTTP 200 · 1134 ms · modo sandbox**

Requisição:

```json
{
  "document": [
    "*********05"
  ]
}
```

Resposta:

```json
{
  "status": 200,
  "body": [
    {
      "document": "*********05",
      "status": "Success"
    }
  ]
}
```

## `POST /api/bills/authorize`

### Pedido 166b31e76d9d (19:27:51)

**19:27:51 · POST `/v5/transactions/billpayments/authorize` · HTTP 400 · 225 ms · modo sandbox**

Correlação: `externalTerminal`=`*****621`

Requisição:

```json
{
  "externalTerminal": "*****621",
  "externalNSU": 436071480,
  "barCode": {
    "type": 2,
    "digitable": "",
    "barCode": "50391063046373102158677654749717835870075273"
  }
}
```

Resposta:

```json
{
  "errorCode": "623",
  "message": "Transação não autorizada - Máximo de R$ 1.000.000,00 permitido para essa operação."
}
```

## `POST /api/dda/cancel`

### Pedido b57883b2d863 (19:28:10)

**19:28:10 · DELETE `/dda-subscription-webservice/v1/subscription/Register` · HTTP 201 · 946 ms · modo sandbox**

Correlação: `clientRequestId`=`lobank-dda-saida-1794436089711-fa9734c4`

Requisição:

```json
{
  "document": "*********05",
  "clientRequestId": "lobank-dda-saida-1794436089711-fa9734c4"
}
```

Resposta:

```json
{
  "status": 201,
  "body": {
    "document": "*********05",
    "clientRequestId": "lobank-dda-saida-1794436089711-fa9734c4",
    "responseDate": "2026-11-11T22:28:10.9417135+00:00",
    "status": "PROCESSING",
    "subscriptionId": "fd461fee-8d00-4fba-abc9-69c7d3d2df89"
  }
}
```

