const { MediaConvertClient, CreateJobCommand } = require("@aws-sdk/client-mediaconvert");

/**
 * This handler is triggered by an S3 'ObjectCreated' event.
 * It takes the newly uploaded video file and starts a transcoding
 * job in AWS Elemental MediaConvert.
 */
exports.handler = async (event) => {
    // 1. Check for required environment variables
    const { JOB_TEMPLATE_NAME, MEDIA_CONVERT_ROLE_ARN, DESTINATION_BUCKET_NAME, AWS_REGION } = process.env;
    if (!JOB_TEMPLATE_NAME || !MEDIA_CONVERT_ROLE_ARN || !DESTINATION_BUCKET_NAME || !AWS_REGION) {
        console.error("Missing required environment variables.");
        return;
    }

    const mediaConvert = new MediaConvertClient({ region: AWS_REGION });
    
    // 2. Get the bucket and file key from the S3 upload event
    const sourceBucket = event.Records[0].s3.bucket.name;
    const sourceKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    const sourceS3 = `s3://${sourceBucket}/${sourceKey}`;
    
    // 3. Define a unique destination path for the processed files
    // Example sourceKey: "creatorId/random-bytes-filename.mp4"
    // We'll use the "creatorId/random-bytes-filename" part as a unique folder name
    const uniqueFolderName = sourceKey.substring(0, sourceKey.lastIndexOf('.'));
    const destinationS3 = `s3://${DESTINATION_BUCKET_NAME}/${uniqueFolderName}/`;

    // 4. Set up the parameters for the transcoding job
    const params = {
        JobTemplate: JOB_TEMPLATE_NAME,
        Role: MEDIA_CONVERT_ROLE_ARN,
        Settings: {
            Inputs: [{
                FileInput: sourceS3,
            }],
            // We override the destination from the template to make it unique for each video
            OutputGroups: [{
                Name: "Apple HLS", // This must match the name of the output group in your template
                OutputGroupSettings: {
                    HlsGroupSettings: {
                        Destination: destinationS3
                    }
                }
            }]
        },
    };

    // 5. Send the command to MediaConvert to start the job
    try {
        await mediaConvert.send(new CreateJobCommand(params));
        console.log(`Successfully started transcoding job for: ${sourceS3}`);
    } catch (error) {
        console.error("Error starting transcoding job:", error);
    }
};