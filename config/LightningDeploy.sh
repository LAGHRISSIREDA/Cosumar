clear

until read -r -p "Your Commit SHA: " commitSHA && test "$commitSHA" != ""; do
  continue
done

until read -r -p "Destination Org (e.g., UAT): " destinationOrg && test "$destinationOrg" != ""; do
  continue
done

echo "Deploy commit $commitSHA to $destinationOrg."
echo "Modified Files : "
git diff-tree --no-commit-id --name-only -r "$commitSHA"
echo "+++++++++++++"

# Concatenate the modified files into a single string and remove the last comma
modifiedFiles=$(git diff-tree --no-commit-id --name-only --diff-filter=AM -r "$commitSHA" | tr '\n' ',' | sed 's/,$//')

# Deploy the modified files to the specified org
sfdx force:source:deploy -p "$modifiedFiles" -u "$destinationOrg" --testlevel RunSpecifiedTests --runtests "CTRL018_RelevDePrixController_Test"