"# xcss"

A simple solution for inheriting css classes.
It solves the problem of not having CSS variables by extending classes.

This scripts iterates through all css rules and detects
rules that have the extends keyword in their selector.

A new rule is added for each rules having the extends keyword
This rule contains the style definitions of the rule itself and the inherited styles.

Beacuse the script iteratese recursively transitive inheritance is also supported.
Baucuse it is possible to build css class hierarchies it can save saves a lot of less or sass work.
