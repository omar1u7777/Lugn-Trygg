# API test commands for wellness goals endpoint

# Valid POST request to update wellness goals
curl -X POST "http://localhost:5001/api/users/74CIFXXGjudQ9wfApiof7GKihv63/wellness-goals" -H "Content-Type: application/json" -d "{\"wellnessGoals\": [\"Hantera stress\", \"Bättre sömn\", \"Ökad fokusering\"]}"

# POST request with empty list (should fail validation)
curl -X POST "http://localhost:5001/api/users/74CIFXXGjudQ9wfApiof7GKihv63/wellness-goals" -H "Content-Type: application/json" -d "{\"wellnessGoals\": []}"

# POST request with missing wellnessGoals key (should fail validation)
curl -X POST "http://localhost:5001/api/users/74CIFXXGjudQ9wfApiof7GKihv63/wellness-goals" -H "Content-Type: application/json" -d "{}"

# POST request with wrong type (string instead of list)
curl -X POST "http://localhost:5001/api/users/74CIFXXGjudQ9wfApiof7GKihv63/wellness-goals" -H "Content-Type: application/json" -d "{\"wellnessGoals\": \"Not a list\"}"

# GET request to retrieve wellness goals
curl -X GET "http://localhost:5001/api/users/74CIFXXGjudQ9wfApiof7GKihv63/wellness-goals"
