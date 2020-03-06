package main

import (
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"context"
	"encoding/json"
	"fmt"
)

type InvokeParams struct {
	Action string
	Schema string
	Table  string
	Data   string
}

func HandleRequest(ctx context.Context, event InvokeParams) (events.APIGatewayProxyResponse, error) {
	jsonEventData, _ := json.Marshal(event)
	responseData := string(jsonEventData)
	fmt.Println(responseData)
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       responseData,
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
}
