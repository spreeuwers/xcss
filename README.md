"# xcss"

XCSS started as simple solution for inheriting css classes.
It solved the problem of not having CSS variables by extending classes.

Experimenting with the content property however I discovered a powerfull
recursive templating solution that is very easy to use.

With this library the following css construct is possible and works  

div {
  content:"`<div></div>`";
}

or 

div {
  content:url(`mymage.html`);
}

It results in nested divs a 100 levels deep. FUN! 


XCSS also adds a ONCLICK and WHEN constructions that enables routing.
Conditional css is applied when a certain hash state is reached. 

The css in the rule is applied only WHEN the hash of the url
equals the name used un the WHEN construction.


!Extend algorithm:

This script iterates through all css rules and detects
rules that have the extends keyword in their selector.

A new rule is added for each rules having the extends keyword
This rule contains the style definitions of the rule itself and the inherited styles.

Because the script iterates recursively through the rules, transitive inheritance is also supported.
It is possible to build css class hierarchies very easy.
This saves a lot of less or sass work.


