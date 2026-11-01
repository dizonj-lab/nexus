"""The agent harness.

Every agent runs here, never on its own. The harness gives an agent:
* a card: its role prompt, the tools it may ask for, its model tier and budget;
* a tool policy: the tools it actually gets are the card's tools that the
  person who started the run is allowed to use (agents never outrank people);
* a budget: steps, tool calls, tokens and wall-clock time;
* a trace: every model turn, tool call, denial and error, stored with the run;
* evals: fixed cases that measure an agent before a card or model change ships.

There is deliberately no tool that applies a change. Agents propose
changesets; a person with changeset:apply decides.
"""
