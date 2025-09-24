# Guide: Setting Up the Direct Monetization Engine

This guide outlines the end-to-end process for configuring the cloud infrastructure required for the "Direct Monetization" feature. This system uses AWS S3, Lambda, and MediaConvert to create a fully automated pipeline for video processing, and a CDN for cost-effective delivery.

### Core Components
- **AWS S3:** Secure, private video storage.
- **AWS Lambda & Elemental MediaConvert:** Automated video transcoding.
- **CDN (e.g., Bunny CDN):** Cheap, fast, and scalable video delivery.

### Prerequisites
1. An active AWS Account.
2. A CDN Provider Account (e.g., Bunny CDN).
3. Your backend `.env` file configured with all required keys and names.

---

### Step 1: Configure AWS S3 (The Vault) 🗄️

You will need two S3 buckets: one for raw uploads and one for the processed, streamable video files.

1.  **Create Buckets:** In the AWS S3 console, create two buckets:
    - `yourplatform-video-uploads-raw` (for creator uploads)
    - `yourplatform-video-processed` (for the transcoded files)
    - Set the region for both to **`af-south-1` (Cape Town)**.
    - Ensure **"Block all public access"** is checked for both buckets.

2.  **Set CORS Policy:** On the `yourplatform-video-uploads-raw` bucket, go to the **"Permissions"** tab, find the CORS section, and paste the following:
    ```json
    [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["PUT"],
            "AllowedOrigins": [
                "http://localhost:3000",
                "[https://www.your-app.com](https://www.your-app.com)"
            ],
            "ExposeHeaders": []
        }
    ]
    ```
    *Note: Remember to replace `https://www.your-app.com` with your actual domain.*

3.  **Create an IAM User for Your Backend:**
    - In the AWS IAM service, create a new user with "Programmatic access".
    - Attach a new policy to this user with the following JSON, replacing the bucket name placeholder:
    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "s3:PutObject",
                    "s3:GetObject"
                ],
                "Resource": "arn:aws:s3:::your-platform-video-uploads-raw/*"
            }
        ]
    }
    ```
    - Save the generated **`Access Key ID`** and **`Secret Access Key`** to your backend's `.env` file.

---

### Step 2: Configure AWS MediaConvert & IAM (The Factory) 🏭

This step creates the "recipe" for converting your videos.

1.  **Create an IAM Role for MediaConvert:**
    - In the IAM console, create a new **Role**.
    - Select **"MediaConvert"** as the trusted service.
    - Attach policies that grant it `s3:GetObject` access to your `uploads-raw` bucket and `s3:PutObject` access to your `processed` bucket.
    - Copy the Role's **ARN** and add it to your `.env` file as `MEDIA_CONVERT_ROLE_ARN`.

2.  **Create a MediaConvert Job Template:**
    - In the AWS Elemental MediaConvert service, create a new **Job Template**.
    - Configure an **Output Group** of type **"Apple HLS"**.
    - Inside this group, create multiple **Outputs** for different resolutions (e.g., 1080p, 720p, 480p).
    - Save the template and copy its name into your `.env` file as `JOB_TEMPLATE_NAME`.

---

### Step 3: Deploy the Transcoding Lambda Function ⚡

This function acts as the automated trigger for your factory.

1.  **Create the Lambda Function:**
    - In the AWS Lambda console, create a new function using a **Node.js** runtime.
    - Assign it an IAM Role that allows it to be triggered by S3 and to start MediaConvert jobs.

2.  **Upload Code:**
    - Create a `.zip` file containing the `index.js`, `package.json`, and `node_modules` folder from your `lambda-jobs/transcode-video/` directory.
    - Upload this `.zip` file to your Lambda function.

3.  **Configure Environment Variables:**
    - In the function's configuration, add the environment variables from your `.env` file: `JOB_TEMPLATE_NAME`, `MEDIA_CONVERT_ROLE_ARN`, `DESTINATION_BUCKET_NAME`, and `AWS_REGION`.

4.  **Set the Trigger:**
    - In the function's configuration, add a trigger.
    - Select **S3** as the source, choose your `yourplatform-video-uploads-raw` bucket, and set the event type to **"All object create events"**.
    - Optionally add a suffix filter (e.g., `.mp4`) to only trigger for video files.

---

### Step 4: Configure the CDN (The Delivery Network) 🚚

This step makes video delivery fast and affordable.

1.  **Create a CDN Pull Zone:**
    - In your CDN provider's dashboard (e.g., Bunny CDN), create a new "Pull Zone".

2.  **Set the Origin:**
    - Set the "Origin URL" to your S3 bucket for **processed** videos (e.g., `yourplatform-video-processed.s3.af-south-1.amazonaws.com`).

3.  **Grant CDN Access:**
    - In your `yourplatform-video-processed` S3 bucket's **Permissions -> Bucket policy**, add a policy that grants `s3:GetObject` permission to your CDN provider's IP addresses. This keeps your files private from the public but accessible to the CDN. Your CDN will provide documentation on the exact policy to use.

---

<!-- Once these steps are complete, your backend infrastructure will be fully configured to securely and automatically handle the entire lifecycle of a directly monetized video. -->