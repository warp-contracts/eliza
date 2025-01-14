
local bint = require('.bint')(256)
local ao = require('ao')
local json = require('json')

ao.authorities = {"f70fYdp_r-oJ_EApckTYQ6d66KaEScQLGTllu98QgXg", "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY", "jmGGoJaDYDTx4OCM7MP-7l-VLIM4ZEGCS0cHPsSmiNE"}

Variant = "0.0.3"

Handlers.add('message', Handlers.utils.hasMatchingTag('Action', 'Send-Message'), function(msg)
      local messageNotice = {
        Target = msg.From,
        Action = 'Message-Notice',
        Data = Colors.gray ..
            "New message " ..
            Colors.blue .. msg.Data .. Colors.reset
      }
      ao.send(messageNotice)
end)
