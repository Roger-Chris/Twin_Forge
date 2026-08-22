# BUILD PROMPT: SOFTWARE-ONLY INDUSTRIAL DIGITAL TWIN

Build a polished, fully functional software prototype called:

# TWINFORGE
### Industrial Digital Twin & Predictive Simulation Platform

Tagline:

**"We don't just monitor machines. We simulate their future."**

This is a demonstration prototype for a hackathon presentation.

## CRITICAL REQUIREMENT

**THIS IS A 100% SOFTWARE SIMULATION.**

There is:

- NO ESP32
- NO Arduino
- NO physical sensors
- NO physical motor
- NO hardware dependency
- NO external MQTT requirement
- NO cloud dependency
- NO external AI API requirement

The entire system must run locally.

The "physical machine" is represented by a **real-time industrial machine simulator** that generates correlated sensor data.

The Digital Twin consumes this telemetry exactly as it would consume telemetry from a real industrial machine.

Do NOT pretend hardware is connected.

Clearly label the source:

**SIMULATION MODE**

---

# 1. CORE CONCEPT

Create a virtual industrial motor and simulate its operation in real time.

The system contains two conceptual layers:

### VIRTUAL PHYSICAL MACHINE

A mathematical/software simulation of an industrial motor.

↓

### DIGITAL TWIN

A synchronized virtual representation of the machine's current state.

↓

### INTELLIGENCE ENGINE

Analyzes the machine state.

↓

### SIMULATION ENGINE

Allows faults and future scenarios to be tested.

The key demonstration is:

**Normal operation → fault injection → cascading effects → future prediction → maintenance recommendation**

---

# 2. MAIN MACHINE

Create one industrial machine:

## MTR-001

Industrial Induction Motor

Parameters:

Rated Voltage: 230 V

Rated RPM: 1500 RPM

Rated Power: 5.5 kW

Normal Temperature: 60–70°C

Normal Vibration: <3 mm/s

Normal Load: 40–75%

The values are demonstration assumptions and must not be presented as universal industrial limits.

---

# 3. REAL-TIME MACHINE SIMULATOR

Create a simulation engine that continuously updates:

- Temperature
- Vibration
- RPM
- Voltage
- Current
- Load
- Bearing health
- Cooling efficiency
- Lubrication health
- Motor efficiency
- Overall health
- Failure probability

The values must be **correlated**, not random.

For example:

Increasing load should cause:

Load ↑
→ Current ↑
→ Temperature gradually ↑
→ Vibration slightly ↑
→ Efficiency ↓

Cooling failure should cause:

Cooling efficiency ↓
→ Temperature ↑
→ Bearing degradation ↑
→ Vibration ↑
→ Failure risk ↑

Bearing degradation should cause:

Bearing health ↓
→ Vibration ↑
→ Mechanical health ↓
→ Failure probability ↑

Voltage drop should cause:

Voltage ↓
→ RPM ↓
→ Current behavior changes
→ Motor efficiency ↓
→ Thermal stress ↑

---

# 4. SIMULATION STATES

The simulator must support:

### NORMAL

Stable operation.

### WARNING

Early abnormal trend.

### CRITICAL

High failure risk.

### FAILURE

Machine has failed.

### RECOVERY

Fault removed and machine returns gradually toward normal.

Do not instantly teleport values between states.

Values should transition smoothly.

---

# 5. MAIN DASHBOARD

Create an impressive industrial control-room dashboard.

## HEADER

TWINFORGE

Industrial Digital Twin

Status:

🟢 SIMULATION RUNNING

Machine:

MTR-001

Operating state:

RUNNING

Simulation speed:

1x / 5x / 10x

---

# 6. HERO 3D DIGITAL TWIN

Use:

React Three Fiber / Three.js

Create a 3D industrial electric motor.

Include:

- Motor body
- Rotor
- Shaft
- Bearings
- Cooling fan
- Housing
- Temperature visualization
- Sensor visualization
- Rotating shaft

The motor should visibly respond to machine state.

### Normal

Smooth rotation.

### High load

Slightly faster visual activity and heat visualization.

### High vibration

Visible vibration effect.

### Overheating

Heat visualization becomes stronger.

### Bearing failure

Mechanical instability and increased vibration.

### Failure

Motor stops.

The 3D machine is the visual centerpiece.

---

# 7. DIGITAL TWIN STATE

Create a panel called:

## DIGITAL TWIN STATE

Show:

Operating State
RUNNING

Health
94%

Temperature
64.2°C

Vibration
2.1 mm/s

RPM
1487

Voltage
229V

Current
4.9A

Load
64%

Bearing Health
95%

Cooling
92%

Efficiency
91%

Failure Risk
4%

All values must update dynamically.

---

# 8. HEALTH SCORE

Create a large circular health indicator:

## 94
HEALTH SCORE

Calculate the score dynamically.

Use weighted factors:

Temperature
Vibration
RPM stability
Voltage stability
Bearing health
Cooling efficiency
Load

The health score must fall when faults are injected.

---

# 9. LIVE TELEMETRY

Create live charts for:

Temperature

Vibration

RPM

Voltage

Current

Load

Allow:

1 minute
5 minutes
15 minutes
30 minutes

The charts must continuously update.

Use smooth animated transitions.

---

# 10. SIMULATION CONTROL

Create:

## MACHINE CONTROL

Controls:

Load slider

Temperature stress slider

Cooling efficiency slider

Voltage slider

Operating speed

Simulation speed

Buttons:

START

PAUSE

RESET

NORMALIZE

The machine state must respond to these controls.

---

# 11. FAULT LAB

This is one of the most important features.

Create a dedicated:

# FAULT LAB

Provide these faults:

### THERMAL

- Overheating
- Cooling failure

### MECHANICAL

- Bearing degradation
- Shaft imbalance
- Excessive vibration

### ELECTRICAL

- Voltage drop
- Overcurrent
- Power instability

### LOAD

- Excessive load

Each fault must contain:

Fault name

Severity

Description

Inject Fault button

Reset Fault button

---

# 12. FAULT INJECTION MUST CHANGE THE SIMULATION

Do NOT simply change the UI.

The fault must modify the machine's actual simulation variables.

Example:

## COOLING FAILURE

Cooling:

92%
→ 80%
→ 65%
→ 45%
→ 25%

Temperature:

64°C
→ 69°C
→ 76°C
→ 84°C
→ 94°C

Bearing:

95%
→ 90%
→ 82%
→ 67%
→ 42%

Vibration:

2.1
→ 2.8
→ 3.7
→ 5.1
→ 7.0 mm/s

Failure risk:

4%
→ 12%
→ 29%
→ 61%
→ 93%

The transitions must happen progressively.

---

# 13. CASCADING FAILURE ENGINE

Implement a deterministic rule-based simulation engine.

Represent relationships between machine parameters.

Example:

Cooling Failure

↓

Cooling Efficiency decreases

↓

Temperature increases

↓

Bearing health decreases

↓

Vibration increases

↓

Mechanical health decreases

↓

Failure probability increases

↓

Potential motor failure

Represent this internally as machine-state dependencies.

The UI should visualize these relationships.

---

# 14. FAULT CASCADE VISUALIZATION

When a fault occurs, show a visual chain:

## COOLING FAILURE

Cooling Efficiency
↓ 48%

↓

Temperature
↑ 31%

↓

Bearing Health
↓ 27%

↓

Vibration
↑ 64%

↓

Failure Risk
↑ 89%

↓

**CRITICAL FAILURE PREDICTED**

Animate the chain as the simulation progresses.

---

# 15. WHAT-IF LAB

Create a separate screen:

# WHAT-IF SIMULATOR

Allow users to configure a hypothetical future scenario without changing the main machine.

Example controls:

Temperature

Load

Voltage

Cooling efficiency

Vibration

Bearing health

Simulation duration:

5 min

10 min

20 min

30 min

60 min

Button:

## RUN WHAT-IF SIMULATION

---

# 16. WHAT-IF EXAMPLES

Provide quick scenario buttons:

### Scenario 1

"What if cooling efficiency drops by 40%?"

### Scenario 2

"What if load increases to 95%?"

### Scenario 3

"What if voltage drops to 180V?"

### Scenario 4

"What if bearing health falls below 50%?"

### Scenario 5

"What if temperature remains above 85°C?"

When clicked, automatically configure the simulator.

---

# 17. FUTURE PROJECTION

After running a scenario, display:

# FAILURE PROJECTION

Timeline:

NOW
↓
+5 MIN
↓
+10 MIN
↓
+20 MIN
↓
+30 MIN

For every point show:

Temperature

Vibration

RPM

Bearing Health

Machine Health

Failure Risk

Example:

### NOW

Temperature: 64°C
Risk: 4%

### +5 MIN

Temperature: 71°C
Risk: 15%

### +10 MIN

Temperature: 79°C
Risk: 42%

### +20 MIN

Temperature: 88°C
Risk: 73%

### +30 MIN

Temperature: 96°C
Risk: 94%

These are simulated projections, not real-world predictions.

---

# 18. PREDICTIVE INTELLIGENCE

Create:

# TWIN INTELLIGENCE

Do not use a fake chatbot.

Create an actual simulation-analysis engine.

Call it:

**Predictive Intelligence Engine**

It should analyze:

- Current state
- Historical trend
- Rate of change
- Fault conditions
- Machine dependencies
- Simulated future state

Generate:

### CURRENT RISK

LOW / MEDIUM / HIGH / CRITICAL

### PREDICTED FAILURE

Example:

Thermal + Bearing degradation

### ESTIMATED FAILURE WINDOW

Example:

18–32 simulated minutes

### CONFIDENCE

Example:

87%

### RECOMMENDATION

Inspect cooling system and bearing condition.

Clearly label this as:

**Simulation-based prediction**

---

# 19. AI-STYLE EXPLANATION

Instead of a chatbot, create a concise explanation:

## WHY IS THE RISK INCREASING?

Example:

"Cooling efficiency has fallen by 42%. The resulting temperature increase is accelerating bearing degradation. Vibration is now trending upward, increasing the probability of mechanical failure."

This explanation must be generated from the current simulation state.

Do not hardcode one explanation for every scenario.

---

# 20. MAINTENANCE CENTER

Create:

# MAINTENANCE

Show:

Current machine condition

Detected issue

Risk

Priority

Recommended action

Estimated failure window

Example:

### BEARING INSPECTION

Priority:
HIGH

Detected condition:
Increasing vibration trend

Recommendation:
Inspect bearing lubrication and mechanical alignment.

Status:

RECOMMENDED

---

# 21. ALERT CENTER

Create real-time alerts.

Example:

🟢 Machine started

🟡 Load increased above normal

🟡 Temperature trend increasing

🟠 Cooling efficiency degraded

🟠 Bearing health declining

🔴 Failure risk exceeds 80%

🔴 Critical condition predicted

Alerts should appear dynamically based on simulation conditions.

---

# 22. EVENT TIMELINE

Create:

# MACHINE HISTORY

Track:

Machine started

Load changed

Fault injected

Temperature warning

Bearing degradation detected

Prediction generated

Maintenance recommended

Fault resolved

Machine recovered

Show events chronologically.

---

# 23. DIGITAL TWIN SYNCHRONIZATION

Even though everything is simulated, visually demonstrate synchronization.

Show:

## SIMULATED MACHINE

Temperature:
64.2°C

↓

SYNC

↓

## DIGITAL TWIN

Temperature:
64.2°C

Add:

Simulation time:
00:12:43

Twin synchronization:
99.8%

This represents synchronization between the simulated physical machine and its digital representation.

Do NOT claim this is real hardware synchronization.

---

# 24. SYSTEM ARCHITECTURE

Use a clean software architecture:

## Simulation Engine

Generates machine telemetry.

↓

## Machine State Manager

Maintains the current machine state.

↓

## Digital Twin Engine

Synchronizes and visualizes the machine.

↓

## Intelligence Engine

Analyzes trends and risks.

↓

## Fault Simulation Engine

Injects faults and calculates cascading effects.

↓

## What-If Engine

Projects future scenarios.

↓

## React Dashboard

Displays everything.

---

# 25. TECHNOLOGY

Use:

Frontend:
React + TypeScript

3D:
Three.js / React Three Fiber

Charts:
Recharts

Styling:
Tailwind CSS

Backend:
Node.js + Express

Real-time:
WebSocket

Persistence:
SQLite or local JSON

NO external APIs required.

NO cloud required.

NO authentication required.

NO hardware required.

---

# 26. VISUAL DESIGN

Make it look like a serious Industry 4.0 control system.

Theme:

Dark industrial control room.

Use:

Near-black background

Dark panels

Strong typography

Subtle borders

Minimal gradients

Green:
Healthy

Amber:
Warning

Red:
Critical

Blue:
Simulation / information

Avoid:

Excessive glassmorphism

Huge rounded cards

Neon cyberpunk styling

Unnecessary animations

Fake AI chatbot UI

The interface should feel technical and professional.

---

# 27. PRESENTATION MODE

Create a special:

# PRESENTATION MODE

One screen containing:

Large 3D motor

Health score

Live sensor values

Live graph

Machine state

Current fault

Failure risk

Prediction

Simulation timeline

Make this optimized for a projector/laptop screen.

---

# 28. PERFECT DEMO FLOW

The application must support this exact presentation:

## STEP 1

Start machine.

Show:

HEALTHY

Health:
96%

Failure risk:
3%

3D motor rotating.

---

## STEP 2

Increase load to 85%.

Observe:

Current ↑

Temperature ↑

Vibration ↑

Health ↓

---

## STEP 3

Open:

FAULT LAB

Select:

COOLING FAILURE

---

## STEP 4

Inject fault.

Show:

Cooling ↓

Temperature ↑

Bearing health ↓

Vibration ↑

Failure risk ↑

---

## STEP 5

Open:

FAULT CASCADE

Show:

Cooling failure
↓
Thermal stress
↓
Bearing degradation
↓
Vibration
↓
Critical failure risk

---

## STEP 6

Open:

WHAT-IF LAB

Select:

"What if cooling remains unavailable for 30 minutes?"

---

## STEP 7

Run simulation.

Display:

NOW
→ +5
→ +10
→ +20
→ +30 MIN

Show the machine progressively degrading.

---

## STEP 8

Show:

# FAILURE PREDICTED

Risk:
94%

Predicted issue:
Thermal + Bearing failure

---

## STEP 9

Show:

# RECOMMENDED ACTION

Inspect cooling system.

Inspect bearing condition.

Reduce machine load.

---

## STEP 10

Reset.

Machine returns to normal.

---

# 29. DEMO SAFETY NET

The entire application must work with one command.

Example:

npm run demo

This should:

1. Start backend
2. Start simulation engine
3. Start frontend
4. Open dashboard

If backend architecture makes this difficult, provide a simple single-command development setup.

The demo must never depend on internet connectivity.

---

# 30. NO MOCK BUTTONS

Every button must work.

Every slider must affect simulation.

Every fault must affect machine state.

Every simulation must produce a projection.

Every projection must produce a risk score.

Every risk score must produce a meaningful explanation.

Every maintenance recommendation must correspond to the simulated condition.

The 3D motor must react to the simulation.

Charts must update continuously.

---

# 31. FINAL PRODUCT GOAL

The final application should demonstrate:

**A software-defined industrial machine**

↓

**A live digital twin**

↓

**Real-time simulated telemetry**

↓

**Fault injection**

↓

**Cascading failure simulation**

↓

**What-if analysis**

↓

**Predictive intelligence**

↓

**Maintenance recommendation**

The goal is NOT to build an entire industrial platform.

The goal is to create one extremely convincing software Digital Twin demonstration that makes judges immediately understand:

> **"Instead of waiting for a machine to fail, we can simulate the failure, understand how it propagates, and decide what to do before it happens."**

Build the complete working prototype, not a static UI mockup.
