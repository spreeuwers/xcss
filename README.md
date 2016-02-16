"# xcss"

A simple solution for inheriting classes
solves the problem of not having CSS variables
by extending classes

this scripts iterates through all css rules and detects
rules that have the extends keyword in their selector.

A new rule is added for these extends rules
with the self cssText and the inherited cssText

Also transitive inheritance implemented now.
Class hierarchies possible

saves a lot of sass stuff
