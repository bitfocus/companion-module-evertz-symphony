## Evertz Symphony

Control the Evertz MVP, VIP, NGI and Exhibit using the Symphony Protocol.

Requires Companion 5.1 or later.

All development tested with an Evertz MVP. Support for other units untested but in scope of the protocol. Minimum supported MVP firmware is 2.13, some actions require more recent firmware.

### Configuration

- **Model** The actions offered depend on it
- **Hostname** and **Port** The default port is 9750
- **Displays** The number of addressable displays in the system, for the MVP and NGI. Actions choose a display from 1 to this number

### Actions

#### MVP

- **Change Window Source**
- **Run Script**
- **Run Snapshot** Requires MVP software 2.13.0 or greater
- **Route Audio**
- **Save Display** Requires MVP software 2.17.0 or greater
- **Set VGPI**
- **Unassign Window Source**

#### VIP

- **Run Script**

#### NGI

- **Change Window Source**
- **Run Script**

#### Exhibit

- **Hide**
- **Move**
- **Scale**
- **Show**

### Connection

Each message waits for a reply from the unit, for up to 250 ms, before the next is sent.

Once nothing has been sent for 5 seconds, a keepalive is sent.

### Feedbacks

None

### Variables

None
