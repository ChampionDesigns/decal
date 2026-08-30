An empty fixture set on purpose.

The write-frame canary mutates the CONTRACT TABLE, not a fixture: it changes one row's
success body and asserts the mock's synthesized answer stops matching. Pointing that run
at this directory keeps every fixture rule out of the result, so the canary fires for its
own reason and nothing else.
