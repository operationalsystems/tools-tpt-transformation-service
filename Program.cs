using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SIL.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using TptMain.Models;

namespace TptMain
{
    /// <summary>
    /// Main driver class for the service.
    /// </summary>
    [System.Diagnostics.CodeAnalysis.ExcludeFromCodeCoverage]
    public class Program
    {
        public static void Main(string[] args)
        {
            var host = CreateHostBuilder(args).Build();

            // Ensure that the database exists and handle any dangling jobs.
            using (var scope = host.Services.CreateScope())
            {
                IServiceProvider services = scope.ServiceProvider;
                try
                {
                    var context = services.GetRequiredService<TptServiceContext>();
                    context.Database.EnsureCreated();

                    // Eagerly load (including children objects) all jobs.
                    List<PreviewJob> previewJobs = context.PreviewJobs
                                      .Include(x => x.State)
                                      .Include(x => x.BibleSelectionParams)
                                      .Include(x => x.TypesettingParams)
                                      .ToList();

                    // Update dangling jobs to be errored out. They may still be running, but we can't reach them or resume them.
                    foreach (PreviewJob previewJob in previewJobs)
                    {
                        if (!previewJob.State.Any(state => state.State.Equals(JobStateEnum.PreviewGenerated))
                            && !previewJob.State.Any(state => state.State.Equals(JobStateEnum.Cancelled))
                            && !previewJob.State.Any(state => state.State.Equals(JobStateEnum.Error)))
                        {
                            previewJob.SetError("An internal server error occurred.", "Unrecoverable. The system restarted while the job was in progress.");
                            previewJob.State.Add(new PreviewJobState(JobStateEnum.Error));
                            context.PreviewJobs.Update(previewJob);
                        }
                    }

                    // Persist any job updates.
                    context.SaveChanges();
                }
                catch (Exception ex)
                {
                    var logger = services.GetRequiredService<ILogger<Program>>();
                    logger.LogError(ex, "An error occurred while initializing the database.");
                }
            }
            host.Run();
        }

        /// <summary>
        /// Creates, configures, and builds the site host.
        /// </summary>
        /// <param name="args">Program arguments array.</param>
        /// <returns>The HostBuilder</returns>
        [System.Diagnostics.CodeAnalysis.ExcludeFromCodeCoverage]
        private static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
            .UseWindowsService()
            .ConfigureAppConfiguration((hostingContext, config) =>
            {
                config.SetBasePath(Directory.GetCurrentDirectory());
                config.AddJsonFile(Path.Combine("Properties", "serviceSettings.json"));
            })
            .ConfigureLogging(logging =>
            {
                logging
                    .ClearProviders()
                    .AddConsole()
                    .AddEventLog();

                logging
                    .AddFilter("Microsoft", LogLevel.Warning)
                    .AddFilter("System", LogLevel.Warning)
                    .AddFilter("LoggingConsoleApp.Program", LogLevel.Debug);
            })
            .ConfigureWebHostDefaults(webBuilder =>
            {
                webBuilder.UseStartup<Startup>();
            });
    }
}