import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    if (!image) {
      throw new Error("No image provided");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("Processing document image with OpenAI...");

    // Call OpenAI GPT-4 Vision with vision capabilities
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a document data extraction assistant. Extract information from invoices and notification forms.
            
Extract the following information when available:
- Customer name
- Customer contact (phone/email)
- Customer address
- Date(s) on the document
- Item descriptions
- Quantities
- Amounts/prices
- Total amount
- Document type (invoice or notification form)

Return the data as a JSON object with this structure:
{
  "document_type": "invoice" or "notification_form",
  "customer_name": "string",
  "customer_contact": "string",
  "customer_address": "string",
  "date": "string",
  "items": [
    {
      "description": "string",
      "quantity": number,
      "amount": number
    }
  ],
  "total_amount": number
}

Only include fields that you can confidently extract from the document. If a field is not present or unclear, omit it.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract all the data from this document image."
              },
              {
                type: "image_url",
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI response received");

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response from the AI
    let extractedData;
    try {
      // Try to find JSON in the response (sometimes AI wraps it in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.log("Raw AI response:", content);
      throw new Error("Failed to parse extracted data");
    }

    console.log("Successfully extracted data:", extractedData);

    return new Response(
      JSON.stringify({ extractedData }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in extract-document-data function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
