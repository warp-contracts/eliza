

export const GQL_TX_QUERY = `
query ($id: ID!) {
  transaction(id: $id) {
      id
      ingested_at
      recipient
      block {
        timestamp
        height
      }
      tags {
        name
        value
      }
      data {
        size
      }
      owner {
        address
      }
  }
}

`

export const GQL_TXS_QUERY = `query ($entityId: String!, $limit: Int!, $sortOrder: SortOrder!, $cursor: String) {
  transactions(
    sort: $sortOrder
    first: $limit
    after: $cursor
    recipients: [$entityId]
  ) {
    count
    ...MessageFields
  }
}
fragment MessageFields on TransactionConnection {
  edges {
    cursor
    node {
      id
      ingested_at
      recipient
      block {
        timestamp
        height
      }
      tags {
        name
        value
      }
      data {
        size
      }
      owner {
        address
      }
    }
  }
}`
