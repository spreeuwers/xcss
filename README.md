"# xcss"

A simple solution for inheriting css classes.
It solves the problem of not having CSS variables by extending classes.

This scripts iterates through all css rules and detects
rules that have the extends keyword in their selector.

A new rule is added for each rules having the extends keyword
This rule contains the style definitions of the rule itself and the inherited styles.

Because the script iterates recursively through the rules, transitive inheritance is also supported.
It is possible to build css class hierarchies very easy.
This saves a lot of less or sass work.

Also added a WHEN construction. This enables conditional css
the css in the rule is applied only WHEN the hash of the url
equals the name used un the WHEN construction.

