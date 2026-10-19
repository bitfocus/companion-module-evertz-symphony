# companion-module-evertz-symphony

See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE)

## Version History

### Version 2.0.0

- Update to Companion module API 2.2, which needs Companion 5.1 or later
- Convert to TypeScript
- Display, audio pair, VGPI, duration, position and size take variables by expression only. Existing values and variables are converted
- The MVP's Run Script takes variables in a typed script name by expression only. Existing names holding variables are converted
- Fix Move and Scale, which always failed
- Fix Show, which sent `undefined` in place of the protocol version
- Fix the module stopping on an error code the protocol does not list
- Fix the status while connecting, which was sent to Companion as an unknown status
- Fix the actions being set again on every keepalive, every 5 seconds, when the MVP's scripts had not changed
- Fix replies with some sequence numbers, such as `000a`, being taken as unprompted messages
- Fix another send loop being started on every reconnection, none of which stopped
- An MVP listing no scripts no longer offers a script with no name
- A character split between two network packets is read correctly
- Reconnect when a unit that answers the keepalive stops responding
- An action with a value out of range, or run while not connected, fails with an error saying why
- Messages still queued when an action is aborted are not sent
- A connection that keeps failing is logged as an error once, then at debug level

### Version 1.0.4

- Parse local variables

### Version 1.0.3

- Use Node 22

### Version 1.0.2

- Minor fixes

### Version 1.0.0

- Initial Release
